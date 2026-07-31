import { Controller, Get, Put, Post, Delete, Body, Req, UseGuards, Param, Query } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.sub || req.user.id);
  }

  @Get('history')
  async getHistory(@Req() req: any, @Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.profileService.getHistory(req.user.sub || req.user.id, startDate, endDate);
  }

  @Put('me')
  async updateBasicInfo(@Req() req: any, @Body() data: any) {
    return this.profileService.updateBasicInfo(req.user.sub || req.user.id, data);
  }

  @Put('me/bio')
  async updateBio(@Req() req: any, @Body('bio') bio: string) {
    return this.profileService.updateBio(req.user.sub || req.user.id, bio);
  }

  @Put('me/socials')
  async updateSocials(@Req() req: any, @Body('socials') socials: any) {
    return this.profileService.updateSocials(req.user.sub || req.user.id, socials);
  }

  @Post('me/cv')
  async uploadCv(@Req() req: any, @Body() data: { name: string, base64: string }) {
    return this.profileService.uploadCv(req.user.sub || req.user.id, data);
  }

  @Delete('me/cv/:id')
  async deleteCv(@Req() req: any, @Param('id') cvId: string) {
    return this.profileService.deleteCv(req.user.sub || req.user.id, cvId);
  }

  @Put('me/cv/:id/primary')
  async setPrimaryCv(@Req() req: any, @Param('id') cvId: string) {
    return this.profileService.setPrimaryCv(req.user.sub || req.user.id, cvId);
  }
}
