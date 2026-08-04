import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateTaskDto, UpdateTaskDto, CreateCommentDto } from '../dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(projectId: string, userId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true }
    });

    if (!project) throw new NotFoundException('Dự án không tồn tại');

    // Permission check: Owner or member with CAN_CREATE_TASK / PM
    if (project.ownerId !== userId) {
      const member = project.members.find(m => m.userId === userId);
      const hasPermission = member && (
        member.role === 'PM' || 
        member.role === 'LEAD_DEV' || 
        (member.permissions && member.permissions.includes('CAN_CREATE_TASK'))
      );

      if (!hasPermission) {
        throw new ForbiddenException('Bạn không có quyền CAN_CREATE_TASK để tạo nhiệm vụ trong dự án này');
      }
    }

    if (dto.parentId) {
      await this.ensureNoCircularDependency(dto.parentId, null);
    }

    // Strict Escrow Budget Check: Task budget is deducted from project's locked escrow pool
    const existingTasks = await this.prisma.task.findMany({
      where: { projectId },
      select: { budget: true }
    });
    const allocatedBudget = existingTasks.reduce((sum, t) => sum + (t.budget || 0), 0);
    const requestedBudget = Number(dto.budget) || 0;
    const availableEscrow = Math.max(0, (project.budget || 0) - allocatedBudget);

    if (requestedBudget > 0 && requestedBudget > availableEscrow) {
      throw new BadRequestException(
        `Ngân sách nhiệm vụ (${requestedBudget.toLocaleString()} ${project.currency}) vượt quá số dư bảo chứng còn lại của dự án (${availableEscrow.toLocaleString()} ${project.currency}). Vui lòng nạp thêm ngân sách vào dự án trước khi tạo thêm task.`
      );
    }

    const tagsValue = Array.isArray(dto.tags) ? JSON.stringify(dto.tags) : (typeof dto.tags === 'string' ? dto.tags : null);
    const attachmentsValue = typeof dto.attachments === 'object' && dto.attachments !== null ? JSON.stringify(dto.attachments) : (typeof dto.attachments === 'string' ? dto.attachments : null);

    const newTask = await this.prisma.task.create({ 
      data: {
        title: dto.title,
        description: dto.description || 'Chưa có mô tả chi tiết cho nhiệm vụ này.',
        budget: requestedBudget,
        priority: dto.priority || 'Moderate',
        tags: tagsValue,
        attachments: attachmentsValue,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        parentId: dto.parentId || null,
        assigneeId: dto.assigneeId || null,
        status: dto.status || 'OPEN',
        projectId,
      },
      include: {
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });

    // Record ActivityLog for Task Creation
    try {
      await this.prisma.activityLog.create({
        data: {
          userId,
          action: 'TASK_CREATED',
          details: JSON.stringify({
            taskId: newTask.id,
            taskTitle: newTask.title,
            projectId: projectId,
            projectTitle: project.title,
            assigneeId: dto.assigneeId,
            assigneeName: newTask.assignee ? `${newTask.assignee.firstName || ''} ${newTask.assignee.lastName || ''}`.trim() || newTask.assignee.email : null,
            priority: newTask.priority || 'Moderate',
            status: newTask.status,
            budget: newTask.budget,
          })
        }
      });
    } catch (e) {
      console.error('Failed to log TASK_CREATED activity:', e);
    }

    // Notify assignee if assigned
    if (dto.assigneeId) {
      await this.notificationsService.notifyTaskAssigned(
        dto.assigneeId,
        dto.title,
        project.title,
        newTask.id,
        projectId
      );
    }

    return newTask;
  }

  async findAllByProject(projectId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ 
        where: { projectId }, 
        skip, 
        take: limit,
        include: {
          assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.task.count({ where: { projectId } }),
    ]);

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

  async getPublicTasks(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = {
      project: { type: 'PUBLIC' },
      status: 'OPEN',
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ 
        where, 
        skip, 
        take: limit,
        include: { project: { select: { title: true, budget: true, currency: true } } }
      }),
      this.prisma.task.count({ where }),
    ]);

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

  async getJoinedTasks(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = {
      OR: [
        { assigneeId: userId },
        { project: { ownerId: userId } },
        { project: { members: { some: { userId } } } },
      ]
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ 
        where, 
        skip, 
        take: limit,
        include: { 
          project: { 
            select: { 
              id: true, 
              title: true, 
              currency: true, 
              companyName: true, 
              status: true, 
              ownerId: true, 
              budget: true 
            } 
          },
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.task.count({ where }),
    ]);

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

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ 
      where: { id }, 
      include: { 
        project: { 
          include: { members: true } 
        } 
      } 
    });
    if (!task) throw new NotFoundException('Nhiệm vụ không tồn tại');

    // Permission check for marking task as DONE
    if (dto.status === 'DONE') {
      if (task.project.ownerId !== userId) {
        const member = task.project.members.find(m => m.userId === userId);
        const canMoveDone = member && (
          member.role === 'PM' || 
          member.role === 'LEAD_DEV' || 
          (member.permissions && member.permissions.includes('CAN_MOVE_DONE'))
        );

        if (!canMoveDone) {
          throw new ForbiddenException('Bạn không có quyền CAN_MOVE_DONE để duyệt hoàn thành nhiệm vụ này');
        }
      }
    }

    // Budget update validation if changed
    if (dto.budget !== undefined && dto.budget !== task.budget) {
      const otherTasks = await this.prisma.task.findMany({
        where: { projectId: task.projectId, id: { not: id } },
        select: { budget: true }
      });
      const allocatedOther = otherTasks.reduce((sum, t) => sum + (t.budget || 0), 0);
      const maxAllowed = Math.max(0, (task.project.budget || 0) - allocatedOther);
      if (Number(dto.budget) > maxAllowed) {
        throw new BadRequestException(
          `Ngân sách nhiệm vụ mới (${dto.budget.toLocaleString()} ${task.project.currency}) vượt quá số dư bảo chứng tối đa cho phép của dự án (${maxAllowed.toLocaleString()} ${task.project.currency}).`
        );
      }
    }

    const { deadline, tags, attachments, ...restDto } = dto;
    const tagsValue = tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null)) : undefined;
    const attachmentsValue = attachments !== undefined ? (typeof attachments === 'object' && attachments !== null ? JSON.stringify(attachments) : (typeof attachments === 'string' ? attachments : null)) : undefined;

    const updatedTask = await this.prisma.task.update({ 
      where: { id }, 
      data: {
        ...restDto,
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
        ...(tagsValue !== undefined ? { tags: tagsValue } : {}),
        ...(attachmentsValue !== undefined ? { attachments: attachmentsValue } : {}),
      },
      include: {
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });

    // Automatic Payout when Task transitions to DONE
    const isBecomingDone = task.status !== 'DONE' && dto.status === 'DONE';
    if (isBecomingDone && updatedTask.budget > 0 && updatedTask.assigneeId) {
      const targetUserId = updatedTask.assigneeId;
      const payoutAmount = updatedTask.budget;
      const projectCurrency = task.project.currency || 'USD';

      try {
        // 1. Credit wallet balance
        await this.prisma.userWallet.upsert({
          where: { userId: targetUserId },
          create: {
            userId: targetUserId,
            systemCredits: payoutAmount,
          },
          update: {
            systemCredits: { increment: payoutAmount }
          }
        });

        // 2. Record Transaction
        await this.prisma.transaction.create({
          data: {
            userId: targetUserId,
            type: 'PAYOUT',
            amount: payoutAmount,
            currency: projectCurrency,
            status: 'COMPLETED',
            txHash: `task_done_${updatedTask.id}_${Date.now()}`
          }
        });

        // 3. Increment bonusReceived in ProjectMember
        await this.prisma.projectMember.updateMany({
          where: { projectId: task.projectId, userId: targetUserId },
          data: { bonusReceived: { increment: payoutAmount } }
        });

        // 4. Send Notification to Developer
        await this.notificationsService.createNotification(
          targetUserId,
          `🎉 Nhiệm vụ "${updatedTask.title}" đã được nghiệm thu hoàn thành! Bạn nhận được thanh toán ${payoutAmount.toLocaleString()} ${projectCurrency}.`,
          'SYSTEM',
          { taskId: updatedTask.id, projectId: task.projectId, amount: payoutAmount }
        );
      } catch (err) {
        console.error('Failed to auto-payout on task completion:', err);
      }
    }

    // Record Activity Log
    try {
      if (dto.status && dto.status !== task.status) {
        await this.prisma.activityLog.create({
          data: {
            userId,
            action: 'TASK_STATUS_CHANGED',
            details: JSON.stringify({
              taskId: task.id,
              taskTitle: updatedTask.title,
              projectId: task.projectId,
              projectTitle: task.project.title,
              fromStatus: task.status,
              toStatus: dto.status,
              assigneeId: updatedTask.assigneeId,
              assigneeName: updatedTask.assignee ? `${updatedTask.assignee.firstName || ''} ${updatedTask.assignee.lastName || ''}`.trim() || updatedTask.assignee.email : null,
            })
          }
        });
      } else if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
        await this.prisma.activityLog.create({
          data: {
            userId,
            action: 'TASK_ASSIGNED',
            details: JSON.stringify({
              taskId: task.id,
              taskTitle: updatedTask.title,
              projectId: task.projectId,
              projectTitle: task.project.title,
              previousAssigneeId: task.assigneeId,
              newAssigneeId: dto.assigneeId,
              assigneeName: updatedTask.assignee ? `${updatedTask.assignee.firstName || ''} ${updatedTask.assignee.lastName || ''}`.trim() || updatedTask.assignee.email : null,
            })
          }
        });
      } else {
        await this.prisma.activityLog.create({
          data: {
            userId,
            action: 'TASK_UPDATED',
            details: JSON.stringify({
              taskId: task.id,
              taskTitle: updatedTask.title,
              projectId: task.projectId,
              projectTitle: task.project.title,
              updatedFields: Object.keys(dto),
            })
          }
        });
      }
    } catch (e) {
      console.error('Failed to log task update activity:', e);
    }

    // If newly assigned or assignee changed, notify the assignee
    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      await this.notificationsService.notifyTaskAssigned(
        dto.assigneeId,
        updatedTask.title,
        task.project.title,
        updatedTask.id,
        task.projectId
      );
    }

    return updatedTask;
  }

  async addComment(taskId: string, userId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, title: true } } }
    });

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        userId,
        content: dto.content,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });

    if (task) {
      try {
        await this.prisma.activityLog.create({
          data: {
            userId,
            action: 'TASK_COMMENT_ADDED',
            details: JSON.stringify({
              taskId,
              taskTitle: task.title,
              projectId: task.projectId,
              projectTitle: task.project?.title || 'Dự án',
              commentId: comment.id,
              contentPreview: dto.content.length > 120 ? dto.content.substring(0, 120) + '...' : dto.content,
              content: dto.content,
            })
          }
        });
      } catch (e) {
        console.error('Failed to log comment activity:', e);
      }
    }

    return comment;
  }

  async getComments(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getTaskHistory(userId: string, query: {
    projectId?: string;
    action?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find all projects that the user has access to (owned or member)
    const accessibleProjects = await this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      select: { id: true, title: true }
    });

    const accessibleProjectIds = accessibleProjects.map(p => p.id);

    // If specific projectId is requested, verify access
    let targetProjectIds = accessibleProjectIds;
    if (query.projectId && query.projectId !== 'ALL') {
      targetProjectIds = accessibleProjectIds.filter(id => id === query.projectId);
    }

    const whereClause: any = {
      action: {
        in: query.action && query.action !== 'ALL' 
          ? [query.action] 
          : ['TASK_CREATED', 'TASK_STATUS_CHANGED', 'TASK_MOVED', 'TASK_ASSIGNED', 'TASK_COMMENT_ADDED', 'TASK_UPDATED']
      }
    };

    if (query.startDate || query.endDate) {
      whereClause.createdAt = {};
      if (query.startDate) whereClause.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    // Retrieve logs
    const allLogs = await this.prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            avatarUrl: true,
            profile: { select: { title: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter logs belonging to target projects & search query
    const filteredLogs = allLogs.filter(log => {
      let detailsObj: any = null;
      try {
        detailsObj = log.details ? JSON.parse(log.details) : null;
      } catch {
        return false;
      }

      if (!detailsObj || !detailsObj.projectId) return false;
      if (!targetProjectIds.includes(detailsObj.projectId)) return false;

      if (query.search && query.search.trim()) {
        const s = query.search.toLowerCase().trim();
        const taskTitle = (detailsObj.taskTitle || '').toLowerCase();
        const projectTitle = (detailsObj.projectTitle || '').toLowerCase();
        const userFullName = `${log.user?.firstName || ''} ${log.user?.lastName || ''}`.toLowerCase();
        const userName = (log.user?.username || '').toLowerCase();
        const userEmail = (log.user?.email || '').toLowerCase();
        const commentContent = (detailsObj.content || detailsObj.contentPreview || '').toLowerCase();

        return (
          taskTitle.includes(s) || 
          projectTitle.includes(s) || 
          userFullName.includes(s) || 
          userName.includes(s) || 
          userEmail.includes(s) ||
          commentContent.includes(s)
        );
      }

      return true;
    });

    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(skip, skip + limit).map(log => {
      let parsedDetails = {};
      try {
        parsedDetails = log.details ? JSON.parse(log.details) : {};
      } catch {}
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        user: log.user,
        details: parsedDetails,
      };
    });

    return {
      data: paginatedLogs,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit) || 1,
      }
    };
  }

  private async ensureNoCircularDependency(parentId: string, currentTaskId: string | null) {
    let currentParent = await this.prisma.task.findUnique({ where: { id: parentId } });
    let depth = 0;
    const maxDepth = 3;

    while (currentParent) {
      if (depth >= maxDepth) {
        throw new BadRequestException(`Độ sâu phân cấp nhiệm vụ vượt quá giới hạn tối đa (${maxDepth})`);
      }
      if (currentTaskId && currentParent.id === currentTaskId) {
        throw new BadRequestException('Phát hiện quan hệ lặp vòng tròn (circular dependency) giữa các nhiệm vụ');
      }
      if (!currentParent.parentId) break;
      currentParent = await this.prisma.task.findUnique({ where: { id: currentParent.parentId } });
      depth++;
    }
  }
}
