import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, CreateCommentDto } from '../dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateTaskDto) {
    if (dto.parentId) {
      await this.ensureNoCircularDependency(dto.parentId, null);
    }
    return this.prisma.task.create({ data: { ...dto, projectId } });
  }

  async findAllByProject(projectId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where: { projectId }, skip, take: limit }),
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
        include: { project: { select: { title: true, budget: true } } }
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
    const where = { assigneeId: userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ 
        where, 
        skip, 
        take: limit,
        include: { project: { select: { title: true } } }
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
    const task = await this.prisma.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) throw new NotFoundException('Task not found');

    if (dto.status === 'DONE') {
      if (task.project.ownerId !== userId) {
        const member = await this.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: task.projectId, userId } }
        });
        if (!member || !['PM', 'LEAD_DEV'].includes(member.role)) {
          throw new ForbiddenException('Only PM or LEAD_DEV can mark task as DONE');
        }
      }
    }

    return this.prisma.task.update({ where: { id }, data: dto });
  }

  async addComment(taskId: string, userId: string, dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        taskId,
        userId,
        content: dto.content,
      }
    });
  }

  async getComments(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, email: true } } }
    });
  }

  // Prevent infinite recursive tasks
  private async ensureNoCircularDependency(parentId: string, currentTaskId: string | null) {
    let currentParent = await this.prisma.task.findUnique({ where: { id: parentId } });
    let depth = 0;
    const maxDepth = 3; // Limit task nesting to 3 levels

    while (currentParent) {
      if (depth >= maxDepth) {
        throw new BadRequestException(`Task nesting exceeds maximum depth of ${maxDepth}`);
      }
      if (currentTaskId && currentParent.id === currentTaskId) {
        throw new BadRequestException('Circular dependency detected in tasks');
      }
      if (!currentParent.parentId) break;
      currentParent = await this.prisma.task.findUnique({ where: { id: currentParent.parentId } });
      depth++;
    }
  }
}
