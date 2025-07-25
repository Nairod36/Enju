import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: { transactions: true, quests: true }
    });
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { 
        transactions: true,
        quests: true
      },
    });
  }

  async findByWallet(wallet: string) {
    return this.prisma.user.findUnique({
      where: { wallet },
      include: { 
        transactions: true,
        quests: true
      },
    });
  }
}