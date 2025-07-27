import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsObject, IsOptional, IsArray } from 'class-validator';

export class UpdateIslandDto {
  @ApiPropertyOptional({
    description: 'Name of the island',
    example: 'My Updated Island'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Island generation data',
  })
  @IsOptional()
  @IsObject()
  islandData?: any;

  @ApiPropertyOptional({
    description: 'Tree count',
    example: 10
  })
  @IsOptional()
  @IsNumber()
  treeCount?: number;

  @ApiPropertyOptional({
    description: 'Island description',
    example: 'My updated island description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Total trees planted',
    example: 15
  })
  @IsOptional()
  @IsNumber()
  totalTrees?: number;

  @ApiPropertyOptional({
    description: 'Island health score',
    example: 85.5
  })
  @IsOptional()
  @IsNumber()
  healthScore?: number;

  @ApiPropertyOptional({
    description: 'User trees data',
  })
  @IsOptional()
  @IsArray()
  userTrees?: any[];

  @ApiPropertyOptional({
    description: 'Chests data',
  })
  @IsOptional()
  @IsArray()
  chests?: any[];

  @ApiPropertyOptional({
    description: 'Used tiles keys',
  })
  @IsOptional()
  @IsArray()
  usedTiles?: string[];
}