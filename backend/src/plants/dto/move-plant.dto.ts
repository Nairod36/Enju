import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class MoveePlantDto {
    @ApiProperty({
        description: 'New X coordinate (0-9)',
        example: 7,
        minimum: 0,
        maximum: 9
    })
    @IsInt()
    @Min(0)
    @Max(9)
    positionX: number;

    @ApiProperty({
        description: 'New Y coordinate (0-9)',
        example: 2,
        minimum: 0,
        maximum: 9
    })
    @IsInt()
    @Min(0)
    @Max(9)
    positionY: number;
}