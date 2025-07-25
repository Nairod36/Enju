import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString()
  wallet: string;

  @IsString()
  @IsOptional()
  profile?: string;

  @IsNumber()
  @IsOptional()
  progression?: number;
}