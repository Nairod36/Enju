import { IsString, IsNumber } from 'class-validator';

export class CreateTransactionDto {
  @IsNumber()
  userId: number;

  @IsString()
  type: string;

  @IsString()
  chain: string;

  @IsNumber()
  amount: number;

  @IsString()
  reward: string;
}