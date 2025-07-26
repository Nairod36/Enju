import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdatePlantDto {
    @ApiProperty({
        description: 'New name of the plant',
        example: 'Mon Beau Chêne',
        required: false
    })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    name?: string;
}