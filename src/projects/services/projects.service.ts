import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { Web3Service } from '../../web3/services/web3.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly web3Service: Web3Service,
  ) {}

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

  async findAll(page: number, limit: number, search?: string, minBudget?: number, maxBudget?: number) {
    const skip = (page - 1) * limit;
    const where: any = { type: 'PUBLIC' };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { skillsRequired: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (minBudget !== undefined && !isNaN(minBudget)) {
      where.budget = { ...where.budget, gte: minBudget };
    }
    if (maxBudget !== undefined && !isNaN(maxBudget)) {
      where.budget = { ...where.budget, lte: maxBudget };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ 
        skip, 
        take: limit,
        where,
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          members: { select: { id: true, userId: true, role: true } },
          _count: { select: { applications: true, tasks: true, members: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.project.count({ where }),
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
   * - If NO applicants (applications.length === 0): PM can adjust budget up or down (cannot be less than allocated tasks budget).
   * - If ANY applicant exists (applications.length > 0): PM can ONLY increase budget (add funds), CANNOT decrease it!
   */
  async update(id: string, currentUserId: string, dto: UpdateProjectDto) {
    const project = await this.findOne(id);
    this.ensureIsPMOrOwner(project, currentUserId);

    // Strict Budget Escrow Lock Check
    if (dto.budget !== undefined && dto.budget !== project.budget) {
      const applicationCount = await this.prisma.application.count({ where: { projectId: id } });
      const existingTasks = await this.prisma.task.findMany({ where: { projectId: id }, select: { budget: true } });
      const totalTaskBudget = existingTasks.reduce((sum, t) => sum + (t.budget || 0), 0);

      if (applicationCount > 0) {
        if (dto.budget < project.budget) {
          throw new BadRequestException(
            'Ngân sách dự án đã được khóa bảo chứng do đã có ứng viên nộp hồ sơ. Bạn chỉ có thể nạp thêm ngân sách (tăng lên), không được rút bớt ngân sách để đảm bảo quyền lợi ứng viên.'
          );
        }
      } else {
        if (dto.budget < totalTaskBudget) {
          throw new BadRequestException(
            `Ngân sách dự án (${dto.budget.toLocaleString()} ${project.currency}) không thể giảm xuống dưới tổng ngân sách các nhiệm vụ đã phân bổ (${totalTaskBudget.toLocaleString()} ${project.currency}).`
          );
        }
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

    // Create notification for target user with invitation details via NotificationsService
    await this.notificationsService.createNotification(
      targetUser.id,
      `📩 Bạn vừa nhận được lời mời tham gia dự án "${project.title}" với vai trò ${dto.role}.`,
      'PROJECT_INVITE',
      {
        projectId: project.id,
        projectTitle: project.title,
        role: dto.role,
        inviterId: currentUserId,
        memberId: member.id,
        status: 'PENDING'
      }
    );

    return member;
  }

  /**
   * Accept project invitation
   */
  async acceptInvitation(projectId: string, currentUserId: string) {
    const project = await this.findOne(projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: currentUserId } }
    });

    if (!member) {
      throw new NotFoundException('Không tìm thấy lời mời tham gia dự án này');
    }

    // Ghi nhận Activity log
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        action: 'JOIN_PROJECT',
        details: `Người dùng đã chấp nhận tham gia dự án "${project.title}"`,
      }
    });

    return {
      success: true,
      message: `Bạn đã tham gia thành công vào dự án "${project.title}"!`,
      project,
    };
  }

  /**
   * Reject project invitation
   */
  async rejectInvitation(projectId: string, currentUserId: string) {
    const project = await this.findOne(projectId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: currentUserId } }
    });

    if (!member) {
      throw new NotFoundException('Không tìm thấy lời mời tham gia dự án này');
    }

    // Xóa khỏi projectMember
    await this.prisma.projectMember.delete({
      where: { id: member.id }
    });

    // Ghi nhận Activity log
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        action: 'LEAVE_PROJECT',
        details: `Người dùng đã từ chối tham gia dự án "${project.title}"`,
      }
    });

    return {
      success: true,
      message: `Đã từ chối tham gia dự án "${project.title}".`,
    };
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
   * Bonus / Reward standout member (độc lập với quỹ Escrow của Job)
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

    // 1. CHẶN PM TỰ THƯỞNG CHO CHÍNH MÌNH
    if (member.userId === currentUserId) {
      throw new BadRequestException('PM không thể tự thưởng bonus cho chính mình!');
    }

    const currency = (dto.currency || project.currency || 'USD').toUpperCase();
    const amount = Number(dto.amount);
    const source = dto.source || 'CREDIT';

    let realTxHash = `bonus_${projectId}_${Date.now()}`;

    // 2. XỬ LÝ NGUỒN TIỀN THƯỞNG
    if (source === 'ON_CHAIN') {
      if (!member.user.walletAddress) {
        throw new BadRequestException('Thành viên nhận thưởng chưa liên kết địa chỉ ví nhận token on-chain!');
      }
      // Chuyển token trực tiếp từ ví PM sang ví Member trên Blockchain
      const onChainResult = await this.web3Service.transferDirectToken(
        currentUserId,
        member.user.walletAddress,
        amount,
        currency
      );
      realTxHash = onChainResult.txHash;
    } else {
      // NGUỒN CREDIT: Trừ từ số dư Credit của PM
      const pmWallet = await this.prisma.userWallet.findUnique({ where: { userId: currentUserId } });
      const pmCredits = Number(pmWallet?.systemCredits || 0);

      if (pmCredits < amount) {
        throw new BadRequestException(
          `Số dư Credit của bạn (${pmCredits.toLocaleString()} ${currency}) không đủ để thưởng ${amount.toLocaleString()} ${currency}. Vui lòng nạp thêm Credit!`
        );
      }

      // Trừ Credit của PM
      await this.prisma.userWallet.update({
        where: { userId: currentUserId },
        data: {
          systemCredits: { decrement: amount }
        }
      });

      // Cộng Credit cho Member nhận thưởng
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

      // Ghi nhận giao dịch DEBIT cho PM
      await this.prisma.transaction.create({
        data: {
          userId: currentUserId,
          type: 'WITHDRAW',
          amount: -amount,
          currency,
          status: 'COMPLETED',
          txHash: `bonus_debit_${projectId}_${Date.now()}`,
        }
      });
    }

    // 3. Increment bonusReceived on ProjectMember
    const updatedMember = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        bonusReceived: { increment: amount }
      }
    });

    // 4. Create Transaction log cho người nhận
    await this.prisma.transaction.create({
      data: {
        userId: member.userId,
        type: 'PAYOUT',
        amount,
        currency,
        status: 'COMPLETED',
        txHash: realTxHash,
      }
    });

    // 5. Send Notification to recipient
    await this.prisma.notification.create({
      data: {
        userId: member.userId,
        type: 'BONUS',
        content: `🎉 Chúc mừng! Bạn vừa nhận được phần thưởng xuất sắc ${amount.toLocaleString()} ${currency} (${source === 'ON_CHAIN' ? 'On-Chain' : 'Credit'}) từ PM dự án "${project.title}". Lý do: ${dto.reason}`,
      }
    });

    // 6. Activity Log
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        action: 'BONUS_REWARD',
        details: `PM đã thưởng ${amount.toLocaleString()} ${currency} (${source}) cho thành viên ${member.user.email} trong dự án "${project.title}". Lý do: ${dto.reason}`,
      }
    });

    return {
      success: true,
      message: `Đã trao thưởng thành công ${amount.toLocaleString()} ${currency} cho ${member.user.email}!`,
      txHash: realTxHash,
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

    // Get applicant user name for rich notification
    const applicantUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const applicantName = applicantUser ? `${applicantUser.firstName || ''} ${applicantUser.lastName || ''}`.trim() || applicantUser.email : 'Ứng viên';

    // Send notification & activity log to both applicant and PM
    await this.notificationsService.notifyApplication(
      userId,
      project.ownerId,
      project.title,
      applicantName,
      projectId
    );

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
      await this.notificationsService.createNotification(
        application.userId,
        `🎉 Chúc mừng! Hồ sơ ứng tuyển của bạn vào dự án "${project.title}" đã được PM phê duyệt. Bạn đã là thành viên chính thức của dự án!`,
        'APPLICATION_UPDATE',
        { projectId, status: 'APPROVED', projectTitle: project.title }
      );
    } else if (status === 'REJECTED') {
      // Notify candidate
      await this.notificationsService.createNotification(
        application.userId,
        `Hồ sơ ứng tuyển của bạn vào dự án "${project.title}" chưa phù hợp tại thời điểm này. Cảm ơn bạn đã quan tâm!`,
        'APPLICATION_UPDATE',
        { projectId, status: 'REJECTED', projectTitle: project.title }
      );
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

  async completeProject(projectId: string, currentUserId: string) {
    const project = await this.findOne(projectId);
    this.ensureIsPMOrOwner(project, currentUserId);

    if (project.status === 'COMPLETED') {
      throw new BadRequestException('Dự án này đã được hoàn thành trước đó');
    }

    // 1. Calculate completed tasks budgets
    const tasks = await this.prisma.task.findMany({ where: { projectId } });
    const totalPaidTasks = tasks
      .filter(t => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.budget || 0), 0);

    const totalProjectBudget = project.budget || 0;
    const surplusBudget = Math.max(0, totalProjectBudget - totalPaidTasks);
    const currency = project.currency || 'USD';

    // 2. Identify eligible non-PM members (exclude PM and project owner)
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true }
    });
    const eligibleMembers = members.filter(m => m.role !== 'PM' && m.userId !== project.ownerId);

    let sharePerMember = 0;
    let distributedTotal = 0;
    const payoutResults: Array<{ userId: string; email: string; amount: number }> = [];

    // 3. Evenly distribute surplus budget to non-PM members
    if (surplusBudget > 0 && eligibleMembers.length > 0) {
      sharePerMember = Math.floor((surplusBudget / eligibleMembers.length) * 100) / 100;

      for (const member of eligibleMembers) {
        if (sharePerMember <= 0) continue;

        try {
          // A. Credit to user wallet system credits
          await this.prisma.userWallet.upsert({
            where: { userId: member.userId },
            create: { userId: member.userId, systemCredits: sharePerMember },
            update: { systemCredits: { increment: sharePerMember } }
          });

          // B. Update member bonus received
          await this.prisma.projectMember.update({
            where: { id: member.id },
            data: { bonusReceived: { increment: sharePerMember } }
          });

          // C. Create Transaction record
          await this.prisma.transaction.create({
            data: {
              userId: member.userId,
              type: 'PAYOUT',
              amount: sharePerMember,
              currency,
              status: 'COMPLETED',
              txHash: `surplus_${projectId}_${Date.now()}_${member.userId.slice(0, 6)}`
            }
          });

          // D. Notify recipient
          await this.notificationsService.createNotification(
            member.userId,
            `🎉 Dự án "${project.title}" đã hoàn tất! Bạn được chia đều phần ngân sách thặng dư còn lại là +${sharePerMember.toLocaleString()} ${currency}.`,
            'SYSTEM',
            { projectId, amount: sharePerMember, type: 'SURPLUS_DISTRIBUTION' }
          );

          distributedTotal += sharePerMember;
          payoutResults.push({
            userId: member.userId,
            email: member.user.email,
            amount: sharePerMember
          });
        } catch (err) {
          console.error(`Failed to disburse surplus to member ${member.userId}:`, err);
        }
      }
    }

    // 4. Update Project status to COMPLETED
    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'COMPLETED',
        isRecruiting: false
      },
      include: {
        members: { include: { user: true } },
        tasks: true
      }
    });

    // 5. Activity Log
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: currentUserId,
          action: 'PROJECT_COMPLETED',
          details: JSON.stringify({
            projectId,
            projectTitle: project.title,
            totalBudget: totalProjectBudget,
            totalPaidTasks,
            surplusBudget,
            eligibleMembersCount: eligibleMembers.length,
            sharePerMember,
            distributedTotal
          })
        }
      });
    } catch (e) {
      console.error('Failed to log PROJECT_COMPLETED activity:', e);
    }

    return {
      success: true,
      message: `Dự án "${project.title}" đã hoàn thành! Đã chia đều ${distributedTotal.toLocaleString()} ${currency} thặng dư cho ${eligibleMembers.length} thành viên.`,
      project: updatedProject,
      surplusBudget,
      eligibleMembersCount: eligibleMembers.length,
      sharePerMember,
      distributedTotal,
      payoutResults
    };
  }

  private ensureIsPMOrOwner(project: any, userId: string) {
    if (project.ownerId === userId) return;
    const pmMember = project.members?.find((m: any) => m.userId === userId && m.role === 'PM');
    if (!pmMember) {
      throw new ForbiddenException('Chỉ PM hoặc Chủ sở hữu dự án mới có quyền thực hiện thao tác này');
    }
  }
}
