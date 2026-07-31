import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from '../dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    
    // Hide sensitive data
    const { password, encryptedPrivateKey, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const skillsString = dto.skills ? JSON.stringify(dto.skills) : undefined;
    const socialLinksString = dto.socialLinks ? JSON.stringify(dto.socialLinks) : undefined;
    
    const data = {
      ...(dto.cvUrl !== undefined && { cvUrl: dto.cvUrl }),
      ...(skillsString !== undefined && { skills: skillsString }),
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.birthYear !== undefined && { birthYear: dto.birthYear }),
      ...(dto.contactInfo !== undefined && { contactInfo: dto.contactInfo }),
      ...(socialLinksString !== undefined && { socialLinks: socialLinksString }),
    };

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });
    return profile;
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    
    return {
      id: user.id,
      profile: user.profile,
    };
  }
}
