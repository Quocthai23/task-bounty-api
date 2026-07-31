import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

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
    const { firstName, lastName, nickname, avatarUrl, gender, title, experience, skills, githubUrl, portfolioUrl, languages, expectedRate } = data;
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, nickname, avatarUrl },
    });
    return this.prisma.profile.upsert({
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
  }

  async updateBio(userId: string, bio: string) {
    return this.prisma.profile.upsert({
      where: { userId },
      update: { bio },
      create: { userId, bio },
    });
  }

  async updateSocials(userId: string, socials: any) {
    return this.prisma.profile.upsert({
      where: { userId },
      update: { socialLinks: JSON.stringify(socials) },
      create: { userId, socialLinks: JSON.stringify(socials) },
    });
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
    return this.prisma.profile.upsert({
      where: { userId },
      update: { cvs: JSON.stringify(cvs) },
      create: { userId, cvs: JSON.stringify(cvs) },
    });
  }

  async deleteCv(userId: string, cvId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile?.cvs) return;
    
    let cvs = JSON.parse(profile.cvs);
    cvs = cvs.filter((cv: any) => cv.id !== cvId);
    
    return this.prisma.profile.update({
      where: { userId },
      data: { cvs: JSON.stringify(cvs) },
    });
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
