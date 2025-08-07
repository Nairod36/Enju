import * as nearApi from 'near-api-js';
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { NearHTLCEvent, ResolverConfig } from '../types';
import { PriceOracle } from './price-oracle';

export class NearListener extends EventEmitter {
  private near!: nearApi.Near;
  private account!: nearApi.Account;
  private contract!: nearApi.Contract;
  private lastProcessedBlock: number = 0;
  private isListening: boolean = false;
  private priceOracle: PriceOracle;

  constructor(private config: ResolverConfig) {
    super();
    this.priceOracle = new PriceOracle();
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing NEAR listener...');

    // Configure NEAR connection
    const nearConfig: nearApi.ConnectConfig = {
      networkId: this.config.nearNetworkId,
      keyStore: new nearApi.keyStores.InMemoryKeyStore(),
      nodeUrl: this.config.nearRpcUrl,
      walletUrl: `https://wallet.${this.config.nearNetworkId}.near.org`,
      helperUrl: `https://helper.${this.config.nearNetworkId}.near.org`,
    };

    // Add key to keystore
    const keyPair = nearApi.KeyPair.fromString(this.config.nearPrivateKey as any);
    await nearConfig.keyStore!.setKey(
      this.config.nearNetworkId,
      this.config.nearAccountId,
      keyPair
    );

    this.near = await nearApi.connect(nearConfig);
    this.account = await this.near.account(this.config.nearAccountId);

    // Connect to HTLC contract
    this.contract = new nearApi.Contract(
      this.account,
      this.config.nearContractId,
      {
        viewMethods: [
          'get_contract',
          'get_cross_chain_contract',
          'get_contract_count',
          // Partial Fills methods
          'get_partial_fill_swap',
          'get_partial_fill',
          'get_swap_partial_fills',
          'get_swap_progress',
          'get_all_contracts',
          'check_preimage',
          'is_authorized_resolver'
        ],
        changeMethods: [
          'create_htlc',
          'create_cross_chain_htlc',
          'withdraw',
          'complete_cross_chain_swap',
          'refund',
          'refund_cross_chain',
          'authorize_resolver',
          // Partial Fills methods
          'create_partial_fill_swap',
          'create_partial_fill',
          'complete_partial_fill',
          'refund_partial_fill'
        ],
        useLocalViewExecution: false
      }
    );

    // Get current block height
    const status = await this.near.connection.provider.status();
    this.lastProcessedBlock = status.sync_info.latest_block_height;

    console.log(`✅ NEAR listener initialized from block: ${this.lastProcessedBlock}`);
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;

    this.isListening = true;
    console.log('👂 Starting NEAR event listening...');

    // Poll for new transactions every 3 seconds
    setInterval(() => {
      this.pollForTransactions();
    }, 3000);
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    console.log('🛑 NEAR listener stopped');
  }

  private async pollForTransactions(): Promise<void> {
    try {
      const status = await this.near.connection.provider.status();
      const currentBlock = status.sync_info.latest_block_height;

      if (currentBlock > this.lastProcessedBlock) {
        // Check for new transactions in recent blocks
        for (let blockHeight = this.lastProcessedBlock + 1; blockHeight <= currentBlock; blockHeight++) {
          await this.processBlock(blockHeight);
        }
        this.lastProcessedBlock = currentBlock;
      }
    } catch (error) {
      console.error('❌ Error polling NEAR transactions:', error);
    }
  }

  private async processBlock(blockHeight: number): Promise<void> {
    try {
      const block = await this.near.connection.provider.block({ blockId: blockHeight });

      for (const chunk of block.chunks) {
        if (chunk.tx_root === '11111111111111111111111111111111') continue;

        const chunkDetails = await this.near.connection.provider.chunk(chunk.chunk_hash);

        for (const tx of chunkDetails.transactions) {
          if (tx.receiver_id === this.config.nearContractId) {
            await this.processTx(tx, blockHeight);
          }
        }
      }
    } catch (error) {
      // Block might not be available yet, skip silently
    }
  }

  private async processTx(tx: any, blockHeight: number): Promise<void> {
    try {
      const txResult = await this.near.connection.provider.txStatus(
        tx.hash,
        tx.signer_id,
        'FINAL'
      );

      // Parse transaction logs for our contract events
      for (const outcome of txResult.receipts_outcome) {
        for (const log of outcome.outcome.logs) {
          if (log.includes('Cross-chain HTLC created') || log.includes('HTLC created')) {
            await this.parseHTLCLog(log, tx.hash, blockHeight);
          } else if (log.includes('Cross-chain HTLC completed') || log.includes('HTLC withdrawn')) {
            await this.parseCompletionLog(log, tx.hash, blockHeight);
          }
        }
      }
    } catch (error) {
      // Transaction might be pending, skip
    }
  }

  private async parseHTLCLog(log: string, txHash: string, blockHeight: number): Promise<void> {
    try {
      // Parse log format: "Cross-chain HTLC created: cc-sender-receiver-amount-timestamp, sender: ..., amount: ..., timelock: ..."
      const matches = log.match(/HTLC created: ([^,]+), sender: ([^,]+), amount: ([^,]+), timelock: (\d+)/);

      if (matches) {
        const [, contractId, sender, amount, timelock] = matches;

        console.log(`📦 New NEAR HTLC detected:`, {
          contractId,
          sender,
          amount,
          timelock,
          txHash,
          blockHeight
        });

        // Get full contract details
        const contractDetails = await this.getContractDetails(contractId);

        if (contractDetails) {
          const event: NearHTLCEvent = {
            contractId,
            sender: contractDetails.sender,
            receiver: contractDetails.receiver,
            amount: contractDetails.amount,
            hashlock: contractDetails.hashlock,
            timelock: parseInt(contractDetails.timelock),
            ethAddress: contractDetails.ethAddress,
            blockHeight
          };

          this.emit('htlcCreated', event);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing HTLC log:', error);
    }
  }

  private async parseCompletionLog(log: string, txHash: string, blockHeight: number): Promise<void> {
    try {
      // Parse completion logs with secret
      const matches = log.match(/HTLC (?:completed|withdrawn): ([^,]+)(?:, secret: ([^,]+))?/);

      if (matches) {
        const [, contractId, secret] = matches;

        console.log(`✅ NEAR HTLC completed:`, {
          contractId,
          txHash,
          blockHeight,
          secret: secret ? secret.substring(0, 14) + '...' : 'not found in log'
        });

        // Try to extract secret from transaction if not in log
        let extractedSecret = secret;
        if (!extractedSecret) {
          try {
            console.log(`🔍 Fetching transaction details for: ${txHash}`);
            const transaction = await this.near.connection.provider.txStatus(txHash, 'irrelevant', 'FINAL');

            console.log(`🔍 Full transaction result:`, JSON.stringify(transaction, null, 2));

            // Look in receipts outcomes for function call actions
            if (transaction.receipts_outcome) {
              for (const receipt of transaction.receipts_outcome) {
                if (receipt.outcome && receipt.outcome.status) {
                  console.log(`🔍 Receipt outcome:`, JSON.stringify(receipt, null, 2));
                }
              }
            }

            // Look in transaction actions for function call with preimage
            if (transaction.transaction && transaction.transaction.actions) {
              for (const action of transaction.transaction.actions) {
                if (action.FunctionCall && action.FunctionCall.method_name === 'complete_cross_chain_swap') {
                  console.log(`🔍 Found complete_cross_chain_swap action:`, JSON.stringify(action, null, 2));

                  try {
                    const argsBuffer = Buffer.from(action.FunctionCall.args, 'base64');
                    const argsString = argsBuffer.toString('utf8');
                    console.log(`🔍 Decoded function args:`, argsString);

                    const argsObj = JSON.parse(argsString);
                    if (argsObj.preimage) {
                      console.log(`🔍 Found preimage in args:`, argsObj.preimage);
                      const preimageBuffer = Buffer.from(argsObj.preimage, 'base64');
                      extractedSecret = '0x' + preimageBuffer.toString('hex');
                      console.log(`✅ Secret extracted from function call: ${extractedSecret.substring(0, 14)}...`);
                      break;
                    }
                  } catch (decodeError) {
                    console.log('❌ Failed to decode function call args:', decodeError);
                  }
                }
              }
            }

          } catch (error) {
            console.log('⚠️  Could not extract secret from transaction:', (error as Error).message);
          }
        }

        this.emit('htlcCompleted', {
          contractId,
          txHash,
          blockHeight,
          secret: extractedSecret
        });
      }
    } catch (error) {
      console.error('❌ Error parsing completion log:', error);
    }
  }

  async getContractDetails(contractId: string): Promise<any> {
    try {
      // Try cross-chain contract first
      let result = await (this.contract as any).get_cross_chain_contract({ contract_id: contractId });

      if (!result) {
        // Try regular contract
        result = await (this.contract as any).get_contract({ contract_id: contractId });
      }

      if (result) {
        return {
          sender: result[0],
          receiver: result[1],
          amount: result[2],
          hashlock: result[3],
          timelock: result[4],
          withdrawn: result[5],
          refunded: result[6],
          ethAddress: result[7],
          ethTxHash: result[8] || null
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting contract details:', error);
      return null;
    }
  }

  // 🔥 NEW: Create partial fill (user signs only for the specific amount)
  async createPartialFill(params: {
    swapId: string;
    hashlock: string;
    fillAmount: string; // In yoctoNEAR
  }): Promise<string> {
    console.log('🔄 Creating NEAR Partial Fill...');
    console.log('📋 Params:', params);

    const args = {
      swap_id: params.swapId,
      hashlock: Buffer
        .from(params.hashlock.slice(2), 'hex')
        .toString('base64'),
      fill_amount: params.fillAmount
    };

    console.log(`🎯 User will sign for EXACT partial amount: ${params.fillAmount} yoctoNEAR`);

    const result = await this.account.functionCall({
      contractId: this.config.nearContractId,
      methodName: 'create_partial_fill',
      args,
      gas: BigInt('100000000000000'),
      attachedDeposit: BigInt(params.fillAmount), // Exact partial fill amount
    });

    console.log('✅ Partial Fill created:', result.transaction.hash);

    // Extract fill ID from logs
    const allLogs = result.receipts_outcome
      .flatMap(r => r.outcome.logs);
    const line = allLogs.find(l => l.startsWith('Partial Fill created:'));
    if (!line) {
      throw new Error('Partial Fill creation log not found');
    }

    const [, fillId] = line.match(/Partial Fill created:\s*([^,]+)/)!;
    console.log('✅ Partial Fill ID:', fillId);

    return fillId;
  }

  // 🔥 NEW: Create main swap for partial fills
  async createPartialFillSwap(params: {
    receiver: string;
    totalAmount: string; // In yoctoNEAR
    ethAddress: string;
    timelock: number;
  }): Promise<string> {
    console.log('🔄 Creating Partial Fill Swap (main order)...');
    console.log('📋 Params:', params);

    const args = {
      receiver: params.receiver,
      total_amount: params.totalAmount,
      eth_address: params.ethAddress,
      timelock: params.timelock
    };

    console.log(`🎯 Creating main swap for total: ${params.totalAmount} yoctoNEAR`);

    const result = await this.account.functionCall({
      contractId: this.config.nearContractId,
      methodName: 'create_partial_fill_swap',
      args,
      gas: BigInt('100000000000000'),
      attachedDeposit: BigInt('0'), // No deposit for main swap creation
    });

    console.log('✅ Partial Fill Swap created:', result.transaction.hash);

    // Extract swap ID from logs
    const allLogs = result.receipts_outcome
      .flatMap(r => r.outcome.logs);
    const line = allLogs.find(l => l.startsWith('Partial Fill Swap created:'));
    if (!line) {
      throw new Error('Partial Fill Swap creation log not found');
    }

    const [, swapId] = line.match(/Partial Fill Swap created:\s*([^,]+)/)!;
    console.log('✅ Partial Fill Swap ID:', swapId);

    return swapId;
  }

  async completeSwap(contractId: string, secret: string): Promise<void> {
    try {
      console.log('🔄 Completing cross‑chain swap on NEAR:', contractId);

      const cleanId = contractId.replace(/[<>]/g, '');

      console.log('📋 Contract ID:', cleanId);
      // 1️⃣ Convertir le secret HEX en base64
      const preimageBase64 = Buffer
        .from(secret.slice(2), 'hex')    // enlève le "0x"
        .toString('base64');

      // 2️⃣ Appel via account.functionCall
      const result = await this.account.functionCall({
        contractId: this.config.nearContractId,
        methodName: 'complete_cross_chain_swap',
        args: {
          contract_id: contractId,
          preimage: preimageBase64,
          eth_tx_hash: 'resolved_by_listener'
        },
        gas: BigInt('100000000000000'),  // 100 Tgas
        attachedDeposit: BigInt(0)
      });

      console.log('✅ NEAR swap completed, txHash=', result.transaction.hash);
    } catch (err) {
      console.error('❌ Error completing NEAR swap:', err);
      throw err;
    }
  }

  async completeHTLC(contractId: string, secret: string): Promise<any> {
    console.log(`🔓 Auto-completing NEAR HTLC: ${contractId} with secret: ${secret.substring(0, 14)}...`);

    try {
      const cleanId = contractId.replace(/[<>]/g, '');

      // Convert HEX secret to base64
      const preimageBase64 = Buffer
        .from(secret.slice(2), 'hex')
        .toString('base64');

      const result = await this.account.functionCall({
        contractId: this.config.nearContractId,
        methodName: 'complete_cross_chain_swap',
        args: {
          contract_id: cleanId,
          preimage: preimageBase64,
          eth_tx_hash: 'auto_completed_by_bridge_listener'
        },
        gas: BigInt('100000000000000'),
        attachedDeposit: BigInt(0)
      });

      console.log('✅ NEAR HTLC auto-completed successfully:', result.transaction.hash);
      return result;
    } catch (err) {
      console.error('❌ Error auto-completing NEAR HTLC:', err);
      throw err;
    }
  }

  async transferNearToUser(receiverAccount: string, amount: string): Promise<void> {
    try {
      // Convert yoctoNEAR to NEAR for display (1 NEAR = 10^24 yoctoNEAR)
      const nearAmount = ethers.formatUnits(amount, 24);
      console.log(`💸 Transferring ${nearAmount} NEAR to ${receiverAccount}`);

      const result = await this.account.sendMoney(
        receiverAccount,
        BigInt(amount)
      );

      console.log(`✅ NEAR transfer completed: ${result.transaction.hash}`);
      console.log(`📦 ${nearAmount} NEAR sent to ${receiverAccount}`);

    } catch (error) {
      console.error('❌ Failed to transfer NEAR to user:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      contractId: this.config.nearContractId,
      accountId: this.config.nearAccountId,
      networkId: this.config.nearNetworkId
    };
  }
}