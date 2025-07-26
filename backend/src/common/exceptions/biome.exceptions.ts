import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

export class BiomeNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message || 'Biome non trouvé');
  }
}

export class BiomeAccessDeniedException extends ForbiddenException {
  constructor(message?: string) {
    super(message || 'Accès au biome refusé');
  }
}

export class BiomeFullException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Le biome est plein (maximum 25 plantes)');
  }
}

export class InvalidBiomeHealthException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'La santé du biome est invalide');
  }
}