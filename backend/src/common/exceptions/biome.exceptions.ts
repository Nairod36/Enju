import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

export class BiomeNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message || 'Biome not found');
  }
}

export class BiomeNotCreatedYetException extends NotFoundException {
  constructor(walletAddress: string) {
    super(`User ${walletAddress} has not created a biome yet`);
  }
}

export class BiomeAccessDeniedException extends ForbiddenException {
  constructor(message?: string) {
    super(message || 'Access to biome denied');
  }
}

export class BiomeFullException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Biome is full (maximum 25 plants)');
  }
}

export class InvalidBiomeHealthException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Invalid biome health value');
  }
}