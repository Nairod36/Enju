import { connect, Contract, keyStores, Near, Account } from 'near-api-js';
import { Config } from './types';

export class NearClient {
  private near!: Near;
  private account!: Account;
  private contract!: any; // Use any to avoid strict typing issues

  constructor(private config: Config['near']) {}

  /**
   * Initialize NEAR connection
   */
  async initialize(): Promise<void> {
    const keyStore = new keyStores.InMemoryKeyStore();
    
    this.near = await connect({
      networkId: this.config.networkId,
      keyStore,
      nodeUrl: this.config.nodeUrl,
    });

    this.account = await this.near.account(this.config.accountId);
    
    this.contract = new Contract(this.account, this.config.htlcContract, {
      viewMethods: ['get_contract', 'check_preimage'],
      changeMethods: ['create_htlc', 'withdraw', 'refund'],
      useLocalViewExecution: false
    });
  }

  /**
   * Create HTLC with NEAR tokens
   */
  async createHTLC(
    receiver: string,
    amount: string,
    hashlock: Uint8Array,
    timelock: number,
    ethAddress: string
  ): Promise<{ contractId: string; txHash: string }> {
    console.log('Creating HTLC on NEAR:', { receiver, amount, ethAddress });

    // Convert hashlock to Base64 for NEAR
    const hashlockBase64 = Buffer.from(hashlock).toString('base64');

    const result = await this.contract.create_htlc({
      args: {
        receiver,
        hashlock: hashlockBase64,
        timelock,
        eth_address: ethAddress
      },
      attachedDeposit: amount,
      gas: '100000000000000' // 100 TGas
    });

    return {
      contractId: result as string,
      txHash: 'pending' // NEAR doesn't return tx hash directly
    };
  }

  /**
   * Withdraw from HTLC using secret
   */
  async withdraw(contractId: string, preimage: Uint8Array): Promise<string> {
    console.log('Withdrawing from NEAR HTLC:', { contractId });

    const preimageBase64 = Buffer.from(preimage).toString('base64');

    await this.contract.withdraw({
      args: {
        contract_id: contractId,
        preimage: preimageBase64
      },
      gas: '100000000000000'
    });

    return 'pending';
  }

  /**
   * Refund expired HTLC
   */
  async refund(contractId: string): Promise<string> {
    console.log('Refunding NEAR HTLC:', { contractId });

    await this.contract.refund({
      args: {
        contract_id: contractId
      },
      gas: '100000000000000'
    });

    return 'pending';
  }

  /**
   * Get HTLC contract details
   */
  async getContract(contractId: string): Promise<any> {
    return await this.contract.get_contract({
      contract_id: contractId
    });
  }

  /**
   * Get account ID
   */
  getAccountId(): string {
    return this.config.accountId;
  }
}