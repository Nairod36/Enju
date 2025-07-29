import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EscrowEventData {
  eventType: 'SrcEscrowCreated' | 'DstEscrowCreated';
  escrowAddress: string;
  hashlock: string;
  txHash: string;
  blockNumber: number;
  orderHash?: string;
  maker?: string;
  taker?: string;
  amount?: string;
  token?: string;
  chainId: number;
  timestamp: string;
}

@Injectable()
export class EscrowEventService {
  private readonly logger = new Logger(EscrowEventService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Save an escrow event to the database
   */
  async saveEvent(eventData: EscrowEventData): Promise<boolean> {
    try {
      // Check if event already exists
      const existingEvent = await this.prisma.escrowEvent.findUnique({
        where: { txHash: eventData.txHash }
      });

      if (existingEvent) {
        this.logger.debug(`Event ${eventData.txHash} already exists, skipping`);
        return true;
      }

      // Save new event
      await this.prisma.escrowEvent.create({
        data: {
          eventType: eventData.eventType,
          escrowAddress: eventData.escrowAddress,
          hashlock: eventData.hashlock,
          txHash: eventData.txHash,
          blockNumber: eventData.blockNumber,
          orderHash: eventData.orderHash,
          maker: eventData.maker,
          taker: eventData.taker,
          amount: eventData.amount ? parseFloat(eventData.amount) : null,
          token: eventData.token,
          chainId: eventData.chainId,
          processed: false
        }
      });

      this.logger.log(`Saved new ${eventData.eventType} event: ${eventData.txHash}`);
      return true;
    } catch (error) {
      this.logger.error('Error saving event to database:', error);
      return false;
    }
  }

  /**
   * Get recent escrow events from database
   */
  async getRecentEvents(limit: number = 50): Promise<any[]> {
    return this.prisma.escrowEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get events by hashlock
   */
  async getEventsByHashlock(hashlock: string): Promise<any[]> {
    return this.prisma.escrowEvent.findMany({
      where: { hashlock },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get event count by type
   */
  async getEventStats(): Promise<{ [key: string]: number }> {
    const stats = await this.prisma.escrowEvent.groupBy({
      by: ['eventType'],
      _count: {
        id: true
      }
    });

    const result: { [key: string]: number } = {};
    stats.forEach(stat => {
      result[stat.eventType] = stat._count.id;
    });

    return result;
  }
}
