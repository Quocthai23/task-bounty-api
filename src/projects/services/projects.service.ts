import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from '../dto/projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        ...dto,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'PM',
          }
        }
      },
    });
    return project;
  }

  async assignRole(projectId: string, targetUserId: string, role: string, currentUserId: string) {
    const project = await this.findOne(projectId);
    
    // Check if currentUser is PM or Owner
    if (project.ownerId !== currentUserId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: currentUserId } }
      });
      if (!member || member.role !== 'PM') {
        throw new ForbiddenException('Only PM or Owner can assign roles');
      }
    }

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      update: { role },
      create: { projectId, userId: targetUserId, role },
    });
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ skip, take: limit }),
      this.prisma.project.count(),
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

  async getJoinedProjects(userId: string) {
    return this.prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      }
    });
  }

  async getOwnedProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        applications: true,
        members: { include: { user: { select: { id: true, email: true } } } }
      }
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { tasks: true, applications: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, ownerId: string, data: Partial<CreateProjectDto>) {
    const project = await this.findOne(id);
    if (project.ownerId !== ownerId) throw new ForbiddenException('Not your project');

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async apply(projectId: string, userId: string) {
    return this.prisma.application.create({
      data: { projectId, userId, status: 'PENDING' },
    });
  }

  async getApplications(projectId: string, ownerId: string) {
    const project = await this.findOne(projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenException('Not your project');

    return this.prisma.application.findMany({ 
      where: { projectId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });
  }

  async processApplication(projectId: string, applicationId: string, ownerId: string, status: string) {
    const project = await this.findOne(projectId);
    if (project.ownerId !== ownerId) throw new ForbiddenException('Not your project');

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status }, // APPROVED, REJECTED
    });
  }
}
