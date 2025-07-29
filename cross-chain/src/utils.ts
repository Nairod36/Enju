import crypto from 'crypto';

export class Utils {
  /**
   * Generate random secret for HTLC
   */
  static generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate hashlock from secret
   */
  static generateHashlock(secret: string): string {
    const secretBuffer = Buffer.from(secret, 'hex');
    return crypto.createHash('sha256').update(secretBuffer).digest('hex');
  }

  /**
   * Generate hashlock as bytes32 for Ethereum
   */
  static generateHashlockBytes32(secret: string): string {
    const hashlock = this.generateHashlock(secret);
    return '0x' + hashlock;
  }

  /**
   * Generate unique contract ID
   */
  static generateContractId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get future timestamp (24 hours from now)
   */
  static getFutureTimestamp(): number {
    return Date.now() + (24 * 60 * 60 * 1000);
  }

  /**
   * Convert hex to Uint8Array for NEAR
   */
  static hexToUint8Array(hex: string): Uint8Array {
    const cleanHex = hex.replace('0x', '');
    return new Uint8Array(Buffer.from(cleanHex, 'hex'));
  }
}