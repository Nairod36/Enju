import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateQuestDto } from './dto/create-quest.dto';

@Injectable()
export class QuestsService {
  constructor(private prisma: PrismaService) {}

  async create(createQuestDto: CreateQuestDto) {
    return this.prisma.quest.create({
      data: createQuestDto,
    });
  }

  async findByUserId(userId: number) {
    return this.prisma.quest.findMany({
      where: { userId }
    });
  }

  async findAll() {
    return this.prisma.quest.findMany({
      include: { user: true }
    });
  }

  async updateStatus(id: number, status: string) {
    return this.prisma.quest.update({
      where: { id },
      data: { status }
    });
  }
}