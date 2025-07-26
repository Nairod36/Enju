import { BadRequestException, NotFoundException, ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';

export class UserNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message || 'Utilisateur non trouvé');
  }
}

export class WalletNotConnectedException extends UnauthorizedException {
  constructor(message?: string) {
    super(message || 'Wallet non connecté');
  }
}

export class InvalidWalletAddressException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Adresse de wallet invalide');
  }
}

export class InvalidSignatureException extends UnauthorizedException {
  constructor(message?: string) {
    super(message || 'Signature invalide');
  }
}

export class NonceNotFoundException extends UnauthorizedException {
  constructor(message?: string) {
    super(message || 'Nonce non trouvé. Veuillez demander un nouveau nonce');
  }
}

export class UsernameAlreadyTakenException extends ConflictException {
  constructor(username: string) {
    super(`Le nom d'utilisateur "${username}" est déjà pris`);
  }
}

export class EmailAlreadyTakenException extends ConflictException {
  constructor(email: string) {
    super(`L'email "${email}" est déjà utilisé`);
  }
}

export class InsufficientActivityException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Activité insuffisante pour effectuer cette action');
  }
}