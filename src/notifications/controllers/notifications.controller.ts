import { Controller, Get, Put, UseGuards, Request, Query, Param } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaginatedNotificationResponseDto } from '../dto/notifications.dto';

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Get unified notifications & activity history' })
  @ApiResponse({ status: 200, description: 'Return a list of notifications.', type: PaginatedNotificationResponseDto })
  @Get()
  async getNotifications(
    @Request() req: any, 
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const userId = req.user.sub || req.user.id;

    return this.notificationsService.getUnifiedHistory(
      userId,
      category,
      startDate,
      endDate,
      p,
      l,
    );
  }

  @ApiOperation({ summary: 'Scan active deadlines and generate notifications' })
  @Get('scan-deadlines')
  async scanDeadlines(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.notificationsService.checkDeadlines(userId);
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Put(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub || req.user.id;
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
