import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateQuestDto {
  @IsNumber()
  userId: number;

  @IsString()
  status: string;

  @IsOptional()
  rewards?: any;
}