import { Controller, Post, Body, HttpCode, HttpStatus, Put, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto, AuthResponseDto, MessageResponseDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto, ChallengeResponseDto } from '../dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';
import { ChallengeOtpGuard } from '../guards/challenge-otp.guard';
import { RequireChallenge } from '../decorators/require-challenge.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    if (accessToken) res.cookie('access_token', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15m
    if (refreshToken) res.cookie('refresh_token', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7d
  }

  @ApiOperation({ summary: 'Send OTP for a specific context (e.g. REGISTER, WITHDRAW)' })
  @ApiResponse({ status: 201, description: 'OTP sent to email.', type: MessageResponseDto })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Max 3 per minute
  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @ApiOperation({ summary: 'Verify OTP and get a challenge token' })
  @ApiResponse({ status: 201, description: 'OTP verified successfully.', type: ChallengeResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid or expired OTP' })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @ApiOperation({ summary: 'Register a new user' })
  @ApiHeader({ name: 'x-challenge-token', required: true, description: 'Challenge Token obtained from /auth/verify-otp' })
  @ApiResponse({ status: 201, description: 'User successfully registered.', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request - Email already in use or validation error' })
  @RequireChallenge('REGISTER')
  @UseGuards(ChallengeOtpGuard)
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @ApiOperation({ summary: 'Login and get tokens' })
  @ApiResponse({ status: 200, description: 'User successfully logged in.', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid credentials' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed.', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or expired refresh token' })
  @Post('refresh')
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: Response, @Body() dto: RefreshTokenDto) {
    const token = req.cookies?.refresh_token || dto.refreshToken;
    const result = await this.authService.refreshToken(token);
    this.setCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.', type: MessageResponseDto })
  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return this.authService.logout(req.user.sub);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully.', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request - Incorrect old password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard)
  @Put('change-password')
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto);
  }
}
