// health-cron.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthCronService {
    private readonly logger = new Logger(HealthCronService.name);
    constructor(private readonly prisma: PrismaService) { }

    // toutes les 5 minutes
    @Cron('*/5 * * * *')
    async pingDb() {
        try {
            await this.prisma.healthCheck();
            this.logger.debug('DB ping successful');
        } catch {
            this.logger.error('DB ping failed');
        }
    }
}
