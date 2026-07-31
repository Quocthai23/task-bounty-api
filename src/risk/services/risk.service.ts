import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from '../../notifications/gateways/notifications.gateway';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    this.logger.debug('Running AI Risk Scanner...');
    
    const activeTasks = await this.prisma.task.findMany({
      where: { status: 'IN_PROGRESS' },
      include: { comments: true, project: true }
    });

    for (const task of activeTasks) {
      let riskScore = 0;
      let reasons: string[] = [];

      // Check 1: Time elapsed > 70% but no code (mock check)
      if (task.deadline) {
        const totalDuration = new Date(task.deadline).getTime() - new Date(task.createdAt).getTime();
        const elapsed = Date.now() - new Date(task.createdAt).getTime();
        if (elapsed / totalDuration > 0.7) {
          // Assume we check Webhook logs here, mock as true
          riskScore += 40;
          reasons.push('Đã dùng 70% thời gian nhưng chưa có code mới đẩy lên.');
        }
      }

      // Check 2: No comments/updates in 48h
      const hasRecentComment = task.comments.some(
        c => Date.now() - new Date(c.createdAt).getTime() < 48 * 60 * 60 * 1000
      );
      if (!hasRecentComment) {
        riskScore += 15;
        reasons.push('Không có báo cáo tiến độ trong 48h qua.');
      }

      // Check 3: CI/CD fail or "fix bug", "revert" commits (mock logic)
      const mockCiFail = false; // in real app, query webhooks
      if (mockCiFail) {
        riskScore += 20;
        reasons.push('Phát hiện nhiều commit nhưng CI/CD thất bại.');
      }

      // Update score in DB
      await this.prisma.task.update({
        where: { id: task.id },
        data: { riskScore }
      });

      // Fire notification if > 60
      if (riskScore >= 60) {
        this.notifications.sendRiskAlert(
          task.project.ownerId, 
          `Task [${task.title}] có nguy cơ chậm tiến độ cao. Lý do: ${reasons.join(' ')}`
        );
        this.logger.warn(`Risk Alert sent for Task ${task.id}`);
      }
    }
  }
}
