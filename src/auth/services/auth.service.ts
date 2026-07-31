import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { MailService } from '../../common/mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto, ChangePasswordDto, SendOtpDto, VerifyOtpDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username }
        ]
      }
    });

    if (existing) {
      if (existing.email === dto.email) {
        throw new BadRequestException('Email already in use');
      }
      if (existing.username === dto.username) {
        throw new BadRequestException('Username already in use');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    // Generate Web3 Wallet using ethers.js
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const encryptedPrivateKey = this.encryption.encrypt(wallet.privateKey);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        walletAddress: address,
        encryptedPrivateKey: encryptedPrivateKey,
      },
    });

    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.identifier },
          { username: dto.identifier }
        ]
      }
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')
      });
      
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateToken(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect old password');
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedNewPassword,
        refreshToken: null // Invalidate existing refresh tokens for security
      }
    });

    return { success: true, message: 'Password changed successfully' };
  }

  async sendOtp(dto: SendOtpDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.otpCode.create({
      data: {
        email: dto.email,
        code,
        context: dto.context,
        expiresAt,
      },
    });

    await this.mailService.sendMail(
      dto.email,
      `Your OTP Code for ${dto.context}`,
      `Your verification code is: ${code}. It will expire in 5 minutes.`,
      `<p>Your verification code is: <strong>${code}</strong></p><p>It will expire in 5 minutes.</p>`
    );

    return { success: true, message: 'OTP sent successfully to email' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        email: dto.email,
        code: dto.code,
        context: dto.context,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Clean up used OTPs
    await this.prisma.otpCode.deleteMany({
      where: { email: dto.email, context: dto.context },
    });

    const challengeToken = this.jwtService.sign(
      { email: dto.email, context: dto.context },
      { expiresIn: '15m' }
    );

    return { challengeToken };
  }

  private async generateToken(user: any) {
    const payload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d') as any,
    });

    const hashedRefreshToken = await bcrypt.hash(refresh_token, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken }
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
      }
    };
  }
}
