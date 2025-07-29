import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsObject, IsBoolean, IsOptional } from 'class-validator';

export class CreateIslandDto {
  @ApiProperty({
    description: 'Name of the island',
    example: 'My Beautiful Island'
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Seed for procedural generation',
    example: 123456789
  })
  @IsNumber()
  seed: number;

  @ApiProperty({
    description: 'Island generation data',
    example: {
      landTiles: [],
      waterTiles: [],
      rocks: [],
      houses: [],
      totalTiles: 50,
      waterColor: '#4682B4'
    }
  })
  @IsObject()
  islandData: any;

  @ApiPropertyOptional({
    description: 'Initial tree count',
    example: 5,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  treeCount?: number;

  @ApiPropertyOptional({
    description: 'Set as active island',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Island description',
    example: 'My beautiful tropical island'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Total trees planted',
    example: 10,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  totalTrees?: number;

  @ApiPropertyOptional({
    description: 'Island health score',
    example: 95.5,
    default: 100
  })
  @IsOptional()
  @IsNumber()
  healthScore?: number;

  @ApiPropertyOptional({
    description: 'User trees data',
    example: []
  })
  @IsOptional()
  userTrees?: any[];

  @ApiPropertyOptional({
    description: 'Chests data',
    example: []
  })
  @IsOptional()
  chests?: any[];

  @ApiPropertyOptional({
    description: 'Used tiles keys',
    example: ['tile_1_1', 'tile_2_3']
  })
  @IsOptional()
  usedTiles?: string[];
}