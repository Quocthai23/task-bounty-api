import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { NotificationResponseDto, PaginatedNotificationResponseDto } from '../dto/notifications.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Get user notifications history' })
  @ApiResponse({ status: 200, description: 'Return a list of notifications.', type: PaginatedNotificationResponseDto })
  @Get()
  async getNotifications(@Request() req: any, @Query() query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId: req.user.sub } }),
    ]);
    
    // Auto-mark as read when fetched via REST
    await this.prisma.notification.updateMany({
      where: { userId: req.user.sub, isRead: false },
      data: { isRead: true },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
}
