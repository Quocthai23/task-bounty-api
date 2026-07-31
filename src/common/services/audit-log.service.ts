import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforces append-only logging of critical state changes.
   */
  async logAction(userId: string, action: string, details: any) {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action,
          details: JSON.stringify(details),
        },
      });
      this.logger.log(`AuditLog created: [${action}] by User: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to create AuditLog: ${error.message}`);
    }
  }
}
