import { BadRequestException, NotFoundException, ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';

export class UserNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message || 'User not found');
  }
}

export class UserNotRegisteredYetException extends NotFoundException {
  constructor(walletAddress: string) {
    super(`User with address ${walletAddress} is not registered yet`);
  }
}

export class WalletNotConnectedException extends UnauthorizedException {
  constructor(message?: string) {
    super(message || 'Wallet not connected');
  }
}

export class InvalidWalletAddressException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Invalid wallet address');
  }
}

export class InvalidSignatureException extends UnauthorizedException {
  constructor(message?: string) {
    super(message || 'Invalid signature');
  }
}

export class NonceNotFoundException extends UnauthorizedException {
  constructor(message?: string) {
    super(message || 'Nonce not found. Please request a new nonce first');
  }
}

export class UsernameAlreadyTakenException extends ConflictException {
  constructor(username: string) {
    super(`Username "${username}" is already taken`);
  }
}

export class EmailAlreadyTakenException extends ConflictException {
  constructor(email: string) {
    super(`Email "${email}" is already in use`);
  }
}

export class InsufficientActivityException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Insufficient activity to perform this action');
  }
}