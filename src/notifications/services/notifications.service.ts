import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';

export type NotificationCategory = 
  | 'DEADLINE_ALERT' 
  | 'TASK_ASSIGNED' 
  | 'DEPOSIT_SUCCESS' 
  | 'WITHDRAW_STATUS' 
  | 'PROFILE_UPDATE' 
  | 'APPLICATION_UPDATE' 
  | 'PROFILE_VIEWED' 
  | 'SYSTEM';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Universal notification + activity log dispatcher
   */
  async createNotification(
    userId: string,
    content: string,
    type: NotificationCategory | string,
    details?: any
  ) {
    try {
      // 1. Create Notification record
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          content,
          type: type as string,
          isRead: false,
        },
      });

      // 2. Also record in ActivityLog for unified auditing
      await this.prisma.activityLog.create({
        data: {
          userId,
          action: content,
          details: details ? JSON.stringify(details) : JSON.stringify({ type }),
        },
      });

      // 3. Push real-time event via WebSocket
      if (this.gateway?.server) {
        this.gateway.server.emit(`user-notification-${userId}`, {
          id: notification.id,
          content,
          type,
          createdAt: notification.createdAt,
          details,
        });
        this.gateway.server.emit('notification', {
          userId,
          id: notification.id,
          content,
          type,
          createdAt: notification.createdAt,
        });
      }

      this.logger.log(`Notification sent to User ${userId}: [${type}] ${content}`);
      return notification;
    } catch (error: any) {
      this.logger.error(`Failed to send notification to User ${userId}: ${error.message}`);
    }
  }

  /**
   * ⏰ 1. Cảnh báo trễ hạn (Deadline / Overdue Warning)
   */
  async notifyDeadlineAlert(userId: string, taskTitle: string, isOverdue: boolean, deadline?: Date | string) {
    const deadlineStr = deadline ? new Date(deadline).toLocaleDateString('vi-VN') : '';
    const content = isOverdue
      ? `⏰ Cảnh báo trễ hạn: Nhiệm vụ "${taskTitle}" đã quá hạn chót (${deadlineStr})!`
      : `⚠️ Sắp đến hạn: Nhiệm vụ "${taskTitle}" cần hoàn thành trước ngày ${deadlineStr}.`;

    return this.createNotification(userId, content, 'DEADLINE_ALERT', {
      taskTitle,
      isOverdue,
      deadline,
    });
  }

  /**
   * 📌 2. Thông báo gán Task cho ai (Task Assignment)
   */
  async notifyTaskAssigned(assigneeId: string, taskTitle: string, projectTitle: string, taskId?: string, projectId?: string) {
    const content = `📌 Bạn được phân công nhiệm vụ mới: "${taskTitle}" trong dự án "${projectTitle}".`;
    return this.createNotification(assigneeId, content, 'TASK_ASSIGNED', {
      taskTitle,
      projectTitle,
      taskId,
      projectId,
    });
  }

  /**
   * 💳 3. Thông báo Nạp tiền thành công
   */
  async notifyDepositSuccess(userId: string, amount: number, currency: string = 'VND', txHash?: string) {
    const content = `💳 Nạp tiền thành công: +${Number(amount).toLocaleString('vi-VN')} ${currency} đã được cộng vào số dư ví của bạn.`;
    return this.createNotification(userId, content, 'DEPOSIT_SUCCESS', {
      amount,
      currency,
      txHash,
    });
  }

  /**
   * 💸 4. Thông báo Rút tiền
   */
  async notifyWithdrawal(userId: string, amount: number, currency: string = 'VND', bankMasked?: string, status: string = 'PENDING') {
    const statusText = status === 'COMPLETED' ? 'thành công' : 'đang được xử lý';
    const content = `💸 Yêu cầu rút tiền ${statusText}: Đã rút -${Number(amount).toLocaleString('vi-VN')} ${currency} về tài khoản ${bankMasked || 'ngân hàng'}.`;
    return this.createNotification(userId, content, 'WITHDRAW_STATUS', {
      amount,
      currency,
      bankMasked,
      status,
    });
  }

  /**
   * 👤 5. Thông báo Cập nhật Profile
   */
  async notifyProfileUpdate(userId: string, updatedSummary: string = 'thông tin cá nhân và kỹ năng') {
    const content = `👤 Cập nhật hồ sơ: Bạn vừa cập nhật thành công ${updatedSummary}.`;
    return this.createNotification(userId, content, 'PROFILE_UPDATE', {
      updatedSummary,
    });
  }

  /**
   * 📄 6. Thông báo Ứng tuyển nhiệm vụ / Dự án
   */
  async notifyApplication(applicantId: string, pmId: string, projectTitle: string, applicantName: string, projectId: string) {
    // 6.1 Gửi cho ứng viên
    await this.createNotification(
      applicantId,
      `📄 Ứng tuyển thành công: Bạn đã gửi hồ sơ ứng tuyển vào dự án "${projectTitle}".`,
      'APPLICATION_UPDATE',
      { projectTitle, projectId, role: 'APPLICANT' }
    );

    // 6.2 Gửi cho Nhà tuyển dụng / PM của dự án
    if (pmId && pmId !== applicantId) {
      await this.createNotification(
        pmId,
        `📬 Ứng viên mới: ${applicantName} vừa nộp hồ sơ ứng tuyển vào dự án "${projectTitle}" của bạn.`,
        'APPLICATION_UPDATE',
        { projectTitle, projectId, applicantName, role: 'PM' }
      );
    }
  }

  /**
   * 👁️ 7. Thông báo Nhà tuyển dụng đã xem Profile
   */
  async notifyProfileViewed(candidateUserId: string, viewerName: string, viewerRole: string = 'Nhà tuyển dụng') {
    const content = `👁️ Nhà tuyển dụng đã xem hồ sơ: ${viewerName || 'Một nhà tuyển dụng'} vừa xem hồ sơ năng lực của bạn.`;
    return this.createNotification(candidateUserId, content, 'PROFILE_VIEWED', {
      viewerName,
      viewerRole,
    });
  }

  /**
   * ⏰ Tự động kiểm tra và quét deadline cảnh báo cho người dùng
   */
  async checkDeadlines(userId: string) {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get tasks assigned to user with deadline approaching or overdue that are NOT DONE
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { notIn: ['DONE'] },
        deadline: { lte: next24h },
      },
      include: {
        project: { select: { title: true } },
      },
    });

    const alertsGenerated: string[] = [];

    for (const task of tasks) {
      if (!task.deadline) continue;
      const isOverdue = new Date(task.deadline).getTime() < now.getTime();
      
      // Check if notified recently in the last 12h
      const recentNotif = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: 'DEADLINE_ALERT',
          content: { contains: task.title },
          createdAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
        },
      });

      if (!recentNotif) {
        await this.notifyDeadlineAlert(userId, task.title, isOverdue, task.deadline);
        alertsGenerated.push(task.title);
      }
    }

    return { scanned: tasks.length, alertsGenerated };
  }

  /**
   * Lấy lịch sử hợp nhất (Unified History Log & Notifications)
   */
  async getUnifiedHistory(
    userId: string,
    category?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const notifWhere: any = { userId };
    if (category && category !== 'ALL') {
      notifWhere.type = category;
    }
    if (startDate || endDate) {
      notifWhere.createdAt = {};
      if (startDate) notifWhere.createdAt.gte = new Date(startDate);
      if (endDate) notifWhere.createdAt.lte = new Date(endDate);
    }

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: notifWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: notifWhere }),
    ]);

    // Also get unread count
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }
}
