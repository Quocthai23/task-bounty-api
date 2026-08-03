import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreateProjectDto, 
  UpdateProjectDto, 
  AddMemberByEmailDto, 
  UpdateMemberPermissionsDto, 
  RewardMemberDto, 
  ApplyProjectDto 
} from '../dto/projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    const { initialMemberEmails, deadline, positions, maxMembers, type, budget, currency, skillsRequired, ...rest } = dto;

    const parsedMaxMembers = Number(maxMembers || positions || 5);
    const parsedBudget = Number(budget) >= 0 ? Number(budget) : 0;
    const parsedType = (type || 'PUBLIC').toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
    const parsedCurrency = (currency || 'USD').toUpperCase();

    // Sanitize deadline safely
    let parsedDeadline: Date | null = null;
    if (deadline && typeof deadline === 'string' && deadline.trim() !== '') {
      const parsedTime = Date.parse(deadline);
      if (!isNaN(parsedTime)) {
        parsedDeadline = new Date(parsedTime);
      }
    }

    // Sanitize skillsRequired
    let parsedSkills = skillsRequired || '[]';
    if (Array.isArray(skillsRequired)) {
      parsedSkills = JSON.stringify(skillsRequired);
    } else if (typeof skillsRequired === 'string' && !skillsRequired.startsWith('[')) {
      parsedSkills = JSON.stringify(skillsRequired.split(',').map(s => s.trim()).filter(Boolean));
    }

    const project = await this.prisma.project.create({
      data: {
        ...rest,
        budget: parsedBudget,
        currency: parsedCurrency,
        type: parsedType,
        maxMembers: parsedMaxMembers,
        positions: parsedMaxMembers,
        skillsRequired: parsedSkills,
        deadline: parsedDeadline,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'PM',
            permissions: 'CAN_CREATE_TASK,CAN_MOVE_DONE,CAN_REVIEW_TASK,CAN_ASSIGN_TASK,CAN_MANAGE_MEMBER',
          }
        }
      },
      include: {
        members: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } }
      }
    });

    // Handle initial member emails invitation
    if (initialMemberEmails && Array.isArray(initialMemberEmails) && initialMemberEmails.length > 0) {
      for (const email of initialMemberEmails) {
        if (!email || typeof email !== 'string') continue;
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) continue;
        const user = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
        if (user && user.id !== ownerId) {
          await this.prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: project.id, userId: user.id } },
            update: { role: 'DEV', permissions: 'CAN_VIEW_TASK' },
            create: {
              projectId: project.id,
              userId: user.id,
              role: 'DEV',
              permissions: 'CAN_VIEW_TASK',
            }
          });
        }
      }
    }

    return this.findOne(project.id);
  }

  async getOwnedProjects(userId: string) {
    // Return projects where user is owner OR has PM role in project members
    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, role: 'PM' } } }
        ]
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        applications: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                profile: true,
              }
            }
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                profile: true,
              }
            }
          }
        },
        tasks: {
          select: { id: true, title: true, status: true, budget: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ 
        skip, 
        take: limit,
        where: { type: 'PUBLIC' },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          members: { select: { id: true, userId: true, role: true } },
          _count: { select: { applications: true, tasks: true, members: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.project.count({ where: { type: 'PUBLIC' } }),
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
          some: { userId }
        }
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        members: { include: { user: { select: { id: true, email: true } } } },
        tasks: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { 
        owner: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        applications: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                profile: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                profile: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
    });
    if (!project) throw new NotFoundException('Dự án không tồn tại');
    return project;
  }

  /**
   * Update Project Details with Strict Budget Escrow Locking Rule:
   * If any candidate has applied (applications.length > 0), the budget is permanently locked!
   */
  async update(id: string, currentUserId: string, dto: UpdateProjectDto) {
    const project = await this.findOne(id);
    this.ensureIsPMOrOwner(project, currentUserId);

    // Strict Budget Escrow Lock Check
    if (dto.budget !== undefined && dto.budget !== project.budget) {
      const applicationCount = await this.prisma.application.count({ where: { projectId: id } });
      if (applicationCount > 0) {
        throw new BadRequestException(
          'Ngân sách dự án đã được KHÓA CỐ ĐỊNH do đã có ứng viên nộp hồ sơ ứng tuyển. Không thể thay đổi mức ngân sách để đảm bảo quyền lợi và tính minh bạch cho ứng viên.'
        );
      }
    }

    const { deadline, ...dataToUpdate } = dto;

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dataToUpdate,
        ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {})
      },
      include: {
        members: { include: { user: true } },
        applications: { include: { user: { include: { profile: true } } } },
        tasks: true,
      }
    });
  }

  /**
   * Add a project member directly by email
   */
  async addMemberByEmail(projectId: string, currentUserId: string, dto: AddMemberByEmailDto) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    const cleanEmail = dto.email.trim().toLowerCase();
    const targetUser = await this.prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!targetUser) {
      throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    }

    // Check max members
    const currentMemberCount = await this.prisma.projectMember.count({ where: { projectId } });
    if (currentMemberCount >= project.maxMembers) {
      throw new BadRequestException(
        `Dự án đã đủ ${project.maxMembers} thành viên tối đa. Vui lòng nâng số lượng thành viên tối đa (Max Members) trước khi thêm người mới.`
      );
    }

    const permissions = dto.permissions || (dto.role === 'PM' ? 'CAN_CREATE_TASK,CAN_MOVE_DONE,CAN_REVIEW_TASK,CAN_ASSIGN_TASK' : 'CAN_VIEW_TASK');

    const member = await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: targetUser.id } },
      update: {
        role: dto.role,
        permissions,
      },
      create: {
        projectId,
        userId: targetUser.id,
        role: dto.role,
        permissions,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: true,
          }
        }
      }
    });

    // Create notification for target user
    await this.prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: 'SYSTEM',
        content: `Bạn đã được thêm vào dự án "${project.title}" với vai trò ${dto.role}.`,
      }
    });

    return member;
  }

  /**
   * Update member permissions and roles (e.g. CAN_CREATE_TASK, CAN_MOVE_DONE)
   */
  async updateMemberPermissions(projectId: string, memberId: string, currentUserId: string, dto: UpdateMemberPermissionsDto) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    const member = await this.prisma.projectMember.findUnique({ where: { id: memberId } });
    if (!member || member.projectId !== projectId) {
      throw new NotFoundException('Không tìm thấy thành viên trong dự án');
    }

    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        permissions: dto.permissions,
        ...(dto.role ? { role: dto.role } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: true,
          }
        }
      }
    });
  }

  /**
   * Bonus / Reward standout member
   */
  async rewardMember(projectId: string, memberId: string, currentUserId: string, dto: RewardMemberDto) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    const member = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { user: true }
    });

    if (!member || member.projectId !== projectId) {
      throw new NotFoundException('Không tìm thấy thành viên trong dự án');
    }

    const currency = (dto.currency || project.currency || 'USD').toUpperCase();
    const amount = Number(dto.amount);

    // 1. Increment bonusReceived on ProjectMember
    const updatedMember = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        bonusReceived: { increment: amount }
      }
    });

    // 2. Credit to recipient's wallet balance
    await this.prisma.userWallet.upsert({
      where: { userId: member.userId },
      update: {
        systemCredits: { increment: amount }
      },
      create: {
        userId: member.userId,
        systemCredits: amount,
        currency,
      }
    });

    // 3. Create Transaction log
    await this.prisma.transaction.create({
      data: {
        userId: member.userId,
        type: 'PAYOUT',
        amount,
        currency,
        status: 'COMPLETED',
        txHash: `bonus_${projectId}_${Date.now()}`,
      }
    });

    // 4. Send Notification to recipient
    await this.prisma.notification.create({
      data: {
        userId: member.userId,
        type: 'SYSTEM',
        content: `🎉 Chúc mừng! Bạn vừa nhận được phần thưởng xuất sắc ${amount} ${currency} từ PM dự án "${project.title}". Lý do: ${dto.reason}`,
      }
    });

    // 5. Activity Log
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        action: 'BONUS_REWARD',
        details: `PM đã thưởng ${amount} ${currency} cho thành viên ${member.user.email} trong dự án "${project.title}". Lý do: ${dto.reason}`,
      }
    });

    return {
      success: true,
      message: `Đã trao thưởng thành công ${amount} ${currency} cho ${member.user.email}!`,
      member: updatedMember,
    };
  }

  /**
   * Apply for a project
   */
  async apply(projectId: string, userId: string, dto?: ApplyProjectDto) {
    const project = await this.findOne(projectId);

    if (!project.isRecruiting || project.status === 'COMPLETED') {
      throw new BadRequestException('Dự án này hiện không mở tuyển thành viên');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });
    if (existingMember) {
      throw new BadRequestException('Bạn đã là thành viên của dự án này');
    }

    // Check existing application
    const existingApp = await this.prisma.application.findFirst({
      where: { projectId, userId }
    });
    if (existingApp) {
      throw new BadRequestException('Bạn đã gửi hồ sơ ứng tuyển vào dự án này rồi');
    }

    const application = await this.prisma.application.create({
      data: {
        projectId,
        userId,
        status: 'PENDING',
        coverLetter: dto?.coverLetter || '',
      },
    });

    // Notify project PM/Owner
    await this.prisma.notification.create({
      data: {
        userId: project.ownerId,
        type: 'SYSTEM',
        content: `Có ứng viên mới vừa nộp đơn ứng tuyển vào dự án "${project.title}".`,
      }
    });

    return application;
  }

  async getApplications(projectId: string, currentUserId: string) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    return this.prisma.application.findMany({ 
      where: { projectId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Process an application (APPROVE or REJECT)
   */
  async processApplication(projectId: string, applicationId: string, currentUserId: string, status: string) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true }
    });

    if (!application || application.projectId !== projectId) {
      throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
    }

    if (status === 'APPROVED') {
      // Check max members
      const currentMemberCount = await this.prisma.projectMember.count({ where: { projectId } });
      if (currentMemberCount >= project.maxMembers) {
        throw new BadRequestException(
          `Dự án đã đủ ${project.maxMembers} thành viên tối đa. Vui lòng nâng số lượng thành viên tối đa trước khi duyệt thêm ứng viên.`
        );
      }

      // Add as ProjectMember
      await this.prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: application.userId } },
        update: {
          role: 'DEV',
          permissions: 'CAN_VIEW_TASK',
        },
        create: {
          projectId,
          userId: application.userId,
          role: 'DEV',
          permissions: 'CAN_VIEW_TASK',
        }
      });

      // If reached max members, automatically toggle isRecruiting to false
      if (currentMemberCount + 1 >= project.maxMembers) {
        await this.prisma.project.update({
          where: { id: projectId },
          data: { isRecruiting: false }
        });
      }

      // Notify candidate
      await this.prisma.notification.create({
        data: {
          userId: application.userId,
          type: 'SYSTEM',
          content: `🎉 Chúc mừng! Hồ sơ ứng tuyển của bạn vào dự án "${project.title}" đã được PM phê duyệt. Bạn đã là thành viên chính thức của dự án!`,
        }
      });
    } else if (status === 'REJECTED') {
      // Notify candidate
      await this.prisma.notification.create({
        data: {
          userId: application.userId,
          type: 'SYSTEM',
          content: `Hồ sơ ứng tuyển của bạn vào dự án "${project.title}" chưa phù hợp tại thời điểm này. Cảm ơn bạn đã quan tâm!`,
        }
      });
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });
  }

  async assignRole(projectId: string, targetUserId: string, role: string, currentUserId: string) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      update: { role },
      create: { projectId, userId: targetUserId, role },
    });
  }

  private ensureIsPMOrOwner(project: any, userId: string) {
    if (project.ownerId === userId) return;
    const pmMember = project.members?.find((m: any) => m.userId === userId && m.role === 'PM');
    if (!pmMember) {
      throw new ForbiddenException('Chỉ PM hoặc Chủ sở hữu dự án mới có quyền thực hiện thao tác này');
    }
  }
}
