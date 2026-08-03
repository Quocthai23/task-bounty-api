import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, CreateCommentDto } from '../dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.task.create({ 
      data: { ...dto, projectId },
      include: {
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });
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

    return this.prisma.task.update({ 
      where: { id }, 
      data: dto,
      include: {
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });
  }

  async addComment(taskId: string, userId: string, dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        taskId,
        userId,
        content: dto.content,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });
  }

  async getComments(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' }
    });
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
