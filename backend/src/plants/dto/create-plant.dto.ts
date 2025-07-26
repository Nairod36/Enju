import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreatePlantDto {
    @ApiProperty({
        description: 'Name of the plant',
        example: 'Mon Chêne'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'X coordinate (0-9)',
        example: 3,
        minimum: 0,
        maximum: 9
    })
    @IsInt()
    @Min(0)
    @Max(9)
    positionX: number;

    @ApiProperty({
        description: 'Y coordinate (0-9)',
        example: 5,
        minimum: 0,
        maximum: 9
    })
    @IsInt()
    @Min(0)
    @Max(9)
    positionY: number;
}