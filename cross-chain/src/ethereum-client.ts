import { ethers } from 'ethers';
import { Config, HTLCParams } from './types';

// Simple HTLC ABI (just what we need)
const HTLC_ABI = [
  "function createHTLC(address _receiver, address _token, uint256 _amount, bytes32 _hashlock, uint256 _timelock, string memory _nearAccount) external returns (bytes32 contractId)",
  "function createHTLCEth(address _receiver, bytes32 _hashlock, uint256 _timelock, string memory _nearAccount) external payable returns (bytes32 contractId)",
  "function withdraw(bytes32 _contractId, bytes32 _preimage) external",
  "function refund(bytes32 _contractId) external",
  "function getContract(bytes32 _contractId) external view returns (tuple(address sender, address receiver, address token, uint256 amount, bytes32 hashlock, uint256 timelock, bool withdrawn, bool refunded, string nearAccount))"
];

export class EthereumClient {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private htlcContract: ethers.Contract;

  constructor(config: Config['ethereum']) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.htlcContract = new ethers.Contract(config.htlcContract, HTLC_ABI, this.wallet);
  }

  /**
   * Create HTLC with ETH
   */
  async createHTLCEth(
    receiver: string,
    amount: string,
    hashlock: string,
    timelock: number,
    nearAccount: string
  ): Promise<{ contractId: string; txHash: string }> {
    console.log('Creating HTLC with ETH:', { amount, nearAccount });

    const tx = await this.htlcContract.createHTLCEth(
      receiver,
      hashlock,
      timelock,
      nearAccount,
      { value: amount }
    );

    const receipt = await tx.wait();
    
    // Extract contract ID from event logs
    const event = receipt.logs.find((log: any) => 
      log.topics[0] === ethers.id('HTLCCreated(bytes32,address,address,address,uint256,bytes32,uint256,string)')
    );
    
    const contractId = event ? event.topics[1] : ethers.keccak256(ethers.toUtf8Bytes(`${tx.hash}-${Date.now()}`));

    return { contractId, txHash: receipt.hash };
  }

  /**
   * Withdraw from HTLC using secret
   */
  async withdraw(contractId: string, preimage: string): Promise<string> {
    console.log('Withdrawing from HTLC:', { contractId });

    const tx = await this.htlcContract.withdraw(contractId, preimage);
    const receipt = await tx.wait();

    return receipt.hash;
  }

  /**
   * Refund expired HTLC
   */
  async refund(contractId: string): Promise<string> {
    console.log('Refunding HTLC:', { contractId });

    const tx = await this.htlcContract.refund(contractId);
    const receipt = await tx.wait();

    return receipt.hash;
  }

  /**
   * Get HTLC contract details
   */
  async getContract(contractId: string): Promise<any> {
    return await this.htlcContract.getContract(contractId);
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }
}