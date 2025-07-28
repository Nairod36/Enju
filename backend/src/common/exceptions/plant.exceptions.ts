import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

export class PlantNotFoundException extends NotFoundException {
  constructor(message?: string) {
    super(message || 'Plant not found');
  }
}

export class PlantNotOwnedException extends ForbiddenException {
  constructor(message?: string) {
    super(message || 'You do not own this plant');
  }
}

export class PositionOccupiedException extends BadRequestException {
  constructor(x: number, y: number) {
    super(`Position (${x}, ${y}) is already occupied`);
  }
}

export class InvalidPositionException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Invalid position (must be between 0 and 9)');
  }
}

export class PlantDeadException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Cannot perform action on a dead plant');
  }
}

export class PlantTooYoungException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Plant is too young for this action');
  }
}

export class PlantAlreadyWateredException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Plant has already been watered recently');
  }
}