import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IslandResponseDto {
  @ApiProperty({
    description: 'Island unique identifier',
    example: 'clp2x5f6d0000...'
  })
  id: string;

  @ApiProperty({
    description: 'Island name',
    example: 'My Beautiful Island'
  })
  name: string;

  @ApiProperty({
    description: 'Seed for procedural generation',
    example: '123456789'
  })
  seed: string;

  @ApiProperty({
    description: 'Is this the active island',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Island generation data'
  })
  islandData: any;

  @ApiProperty({
    description: 'Tree count',
    example: 5
  })
  treeCount: number;

  @ApiPropertyOptional({
    description: 'Island description',
    example: 'My beautiful island'
  })
  description?: string;

  @ApiProperty({
    description: 'Total trees planted',
    example: 10
  })
  totalTrees: number;

  @ApiProperty({
    description: 'Island health score',
    example: 95.5
  })
  healthScore: number;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-15T10:30:00Z'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last modification date',
    example: '2024-01-15T10:30:00Z'
  })
  lastModified: Date;

  @ApiProperty({
    description: 'Data format version',
    example: '1.0.0'
  })
  version: string;

  @ApiPropertyOptional({
    description: 'User trees data'
  })
  userTrees?: any[];

  @ApiPropertyOptional({
    description: 'Chests data'
  })
  chests?: any[];

  @ApiPropertyOptional({
    description: 'Used tiles keys'
  })
  usedTiles?: string[];
}