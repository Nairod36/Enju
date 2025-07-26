import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

export class PlantNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message || 'Plante non trouvée');
  }
}

export class PlantNotOwnedException extends ForbiddenException {
  constructor(message?: string) {
    super(message || 'Cette plante ne vous appartient pas');
  }
}

export class PositionOccupiedException extends BadRequestException {
  constructor(x: number, y: number) {
    super(`La position (${x}, ${y}) est déjà occupée`);
  }
}

export class InvalidPositionException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Position invalide (doit être entre 0 et 9)');
  }
}

export class PlantDeadException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Impossible d\'effectuer cette action sur une plante morte');
  }
}

export class PlantTooYoungException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'La plante est trop jeune pour cette action');
  }
}

export class PlantAlreadyWateredException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Cette plante a déjà été arrosée récemment');
  }
}