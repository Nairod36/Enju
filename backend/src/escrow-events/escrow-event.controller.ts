import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { EscrowEventService, EscrowEventData } from './escrow-event.service';

@ApiTags('Escrow Events')
@Controller('escrow-events')
export class EscrowEventController {
  private readonly logger = new Logger(EscrowEventController.name);

  constructor(private readonly escrowEventService: EscrowEventService) {}

  @Post()
  @ApiOperation({ summary: 'Save a new escrow event' })
  @ApiResponse({ status: 201, description: 'Event saved successfully' })
  async saveEvent(@Body() eventData: EscrowEventData) {
    try {
      const success = await this.escrowEventService.saveEvent(eventData);
      
      if (success) {
        return {
          success: true,
          message: 'Event saved successfully'
        };
      } else {
        return {
          success: false,
          error: 'Failed to save event'
        };
      }
    } catch (error) {
      this.logger.error('Error saving event:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get recent escrow events' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of events to return (default: 50)' })
  @ApiResponse({ status: 200, description: 'Returns list of recent escrow events' })
  async getRecentEvents(@Query('limit') limit?: string) {
    try {
      const eventLimit = limit ? parseInt(limit, 10) : 50;
      const events = await this.escrowEventService.getRecentEvents(eventLimit);
      
      return {
        success: true,
        data: events,
        count: events.length
      };
    } catch (error) {
      this.logger.error('Error fetching recent events:', error);
      return {
        success: false,
        error: 'Failed to fetch recent events',
        data: []
      };
    }
  }

  @Get('by-hashlock')
  @ApiOperation({ summary: 'Get events by hashlock' })
  @ApiQuery({ name: 'hashlock', required: true, type: String, description: 'Hashlock to search for' })
  @ApiResponse({ status: 200, description: 'Returns events matching the hashlock' })
  async getEventsByHashlock(@Query('hashlock') hashlock: string) {
    try {
      if (!hashlock) {
        return {
          success: false,
          error: 'Hashlock is required',
          data: []
        };
      }

      const events = await this.escrowEventService.getEventsByHashlock(hashlock);
      
      return {
        success: true,
        data: events,
        count: events.length
      };
    } catch (error) {
      this.logger.error('Error fetching events by hashlock:', error);
      return {
        success: false,
        error: 'Failed to fetch events by hashlock',
        data: []
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get event statistics' })
  @ApiResponse({ status: 200, description: 'Returns event statistics' })
  async getStats() {
    try {
      const stats = await this.escrowEventService.getEventStats();
      
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.logger.error('Error fetching stats:', error);
      return {
        success: false,
        error: 'Failed to fetch stats'
      };
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for escrow event service' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async healthCheck() {
    try {
      // Get a count of recent events to verify database connectivity
      const recentEvents = await this.escrowEventService.getRecentEvents(1);
      
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        recentEventCount: recentEvents.length
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}
