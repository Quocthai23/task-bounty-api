import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getProfile(userId: string) {
    let profile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile) {
      profile = await this.prisma.profile.create({
        data: { userId },
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return { ...user, profile };
  }

  async getPublicProfileByUsername(username: string, viewerUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
        profile: true,
      }
    });

    if (!user) return null;

    // If viewed by another authenticated user, send notification to candidate
    if (viewerUserId && viewerUserId !== user.id) {
      const viewer = await this.prisma.user.findUnique({
        where: { id: viewerUserId },
        select: { firstName: true, lastName: true, email: true }
      });
      const viewerName = viewer ? `${viewer.firstName || ''} ${viewer.lastName || ''}`.trim() || viewer.email : 'Nhà tuyển dụng';
      await this.notificationsService.notifyProfileViewed(user.id, viewerName);
    }

    // Get completed jobs as applicant (where they are DEV and project is COMPLETED or CLOSED)
    const completedJobsAsDev = await this.prisma.projectMember.count({
      where: {
        userId: user.id,
        role: 'DEV',
        project: {
          status: { in: ['COMPLETED', 'CLOSED'] }
        }
      }
    });

    // Get completed projects as PM
    const completedJobsAsPm = await this.prisma.project.count({
      where: {
        ownerId: user.id,
        status: { in: ['COMPLETED', 'CLOSED'] }
      }
    });

    return {
      ...user,
      stats: {
        completedJobsAsDev,
        completedJobsAsPm,
        totalJobs: completedJobsAsDev + completedJobsAsPm,
        rating: 4.8
      }
    };
  }

  async getHistory(userId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { userId };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }
    return this.prisma.activityLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateBasicInfo(userId: string, data: any) {
    let { firstName, lastName, nickname, avatarUrl, gender, title, experience, skills, githubUrl, portfolioUrl, languages, expectedRate } = data;
    
    if (avatarUrl && avatarUrl.startsWith('data:image')) {
      const matches = avatarUrl.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const fileName = `${userId}-${Date.now()}.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        
        avatarUrl = `http://localhost:3000/uploads/avatars/${fileName}`;
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, nickname, avatarUrl },
    });
    const updated = await this.prisma.profile.upsert({
      where: { userId },
      update: { 
        gender, title, experience, 
        skills: JSON.stringify(skills), 
        languages: JSON.stringify(languages || []),
        githubUrl, portfolioUrl, expectedRate: expectedRate ? Number(expectedRate) : null 
      },
      create: { 
        userId, gender, title, experience, 
        skills: JSON.stringify(skills), 
        languages: JSON.stringify(languages || []),
        githubUrl, portfolioUrl, expectedRate: expectedRate ? Number(expectedRate) : null 
      },
    });

    await this.notificationsService.notifyProfileUpdate(userId, 'thông tin cơ bản và kỹ năng');
    return updated;
  }

  async updateBio(userId: string, bio: string) {
    const updated = await this.prisma.profile.upsert({
      where: { userId },
      update: { bio },
      create: { userId, bio },
    });
    await this.notificationsService.notifyProfileUpdate(userId, 'tiểu sử giới thiệu cá nhân');
    return updated;
  }

  async updateSocials(userId: string, socials: any) {
    const updated = await this.prisma.profile.upsert({
      where: { userId },
      update: { socialLinks: JSON.stringify(socials) },
      create: { userId, socialLinks: JSON.stringify(socials) },
    });
    await this.notificationsService.notifyProfileUpdate(userId, 'liên kết mạng xã hội');
    return updated;
  }

  async uploadCv(userId: string, data: { name: string, base64: string }) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const cvs = profile?.cvs ? JSON.parse(profile.cvs) : [];
    
    // If it's the first CV, make it primary automatically
    const isPrimary = cvs.length === 0;
    
    const newCv = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name,
      base64: data.base64,
      isPrimary
    };
    
    cvs.push(newCv);
    const updated = await this.prisma.profile.upsert({
      where: { userId },
      update: { cvs: JSON.stringify(cvs) },
      create: { userId, cvs: JSON.stringify(cvs) },
    });

    await this.notificationsService.notifyProfileUpdate(userId, `hồ sơ CV (${data.name})`);
    return updated;
  }

  async deleteCv(userId: string, cvId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile?.cvs) return;
    
    let cvs = JSON.parse(profile.cvs);
    cvs = cvs.filter((cv: any) => cv.id !== cvId);
    
    const updated = await this.prisma.profile.update({
      where: { userId },
      data: { cvs: JSON.stringify(cvs) },
    });
    await this.notificationsService.notifyProfileUpdate(userId, 'danh sách hồ sơ CV');
    return updated;
  }

  async setPrimaryCv(userId: string, cvId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile?.cvs) return;
    
    let cvs = JSON.parse(profile.cvs);
    cvs = cvs.map((cv: any) => ({
      ...cv,
      isPrimary: cv.id === cvId
    }));
    
    return this.prisma.profile.update({
      where: { userId },
      data: { cvs: JSON.stringify(cvs) },
    });
  }
}
