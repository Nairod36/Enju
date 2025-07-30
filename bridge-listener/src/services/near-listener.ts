import * as nearApi from 'near-api-js';
import { EventEmitter } from 'events';
import { NearHTLCEvent, ResolverConfig } from '../types';

export class NearListener extends EventEmitter {
  private near!: nearApi.Near;
  private account!: nearApi.Account;
  private contract!: nearApi.Contract;
  private lastProcessedBlock: number = 0;
  private isListening: boolean = false;

  constructor(private config: ResolverConfig) {
    super();
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
          'authorize_resolver'
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
      // Parse completion logs
      const matches = log.match(/HTLC (?:completed|withdrawn): ([^,]+)/);

      if (matches) {
        const [, contractId] = matches;

        console.log(`✅ NEAR HTLC completed:`, {
          contractId,
          txHash,
          blockHeight
        });

        this.emit('htlcCompleted', {
          contractId,
          txHash,
          blockHeight
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

  async createCrossChainHTLC(params: {
    receiver: string;
    hashlock: string;
    timelock: number;
    ethAddress: string;
    amount: string;
  }): Promise<string> {
    console.log('🔄 Creating NEAR HTLC via RPC with params:', params);

    // 1️⃣ Préparez args & envoyez la tx
    const args = {
      receiver: params.receiver,
      // on convertit l’hex (0x...) en Base64
      hashlock: Buffer
        .from(params.hashlock.slice(2), 'hex')
        .toString('base64'),
      timelock: params.timelock,
      eth_address: params.ethAddress
    };

    // Convert ETH wei to NEAR yoctoNEAR (1 ETH = 1 NEAR, but different decimal places)
    // ETH: 1 ETH = 10^18 wei
    // NEAR: 1 NEAR = 10^24 yoctoNEAR
    // So: 1 ETH (10^18 wei) = 1 NEAR (10^24 yoctoNEAR)
    const ethWei = BigInt(params.amount);
    const nearYocto = ethWei * BigInt('1000000'); // Convert 10^18 to 10^24

    console.log(`💰 Converting: ${params.amount} wei ETH → ${nearYocto.toString()} yoctoNEAR`);

    const result = await this.account.functionCall({
      contractId: this.config.nearContractId,
      methodName: 'create_cross_chain_htlc',
      args,
      gas: BigInt('100000000000000'),
      attachedDeposit: nearYocto,
    });

    // 2️⃣ Parcourez tous les logs pour trouver la ligne “Cross-chain HTLC created: <ID>”
    const allLogs = result.receipts_outcome
      .flatMap(r => r.outcome.logs);
    const line = allLogs.find(l => l.startsWith('Cross-chain HTLC created:'));
    if (!line) {
      throw new Error('Log “Cross-chain HTLC created:” introuvable');
    }

    // 3️⃣ Extraire l’ID interne (jusqu’à la virgule)
    const [, internalId] = line.match(/Cross-chain HTLC created:\s*([^,]+)/)!;

    console.log('✅ NEAR HTLC internal ID:', internalId);
    return internalId;
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