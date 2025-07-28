import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return { 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'Mokuen NestJS Backend'
    };
  }
}