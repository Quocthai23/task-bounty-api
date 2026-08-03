import { Controller, Get, Param, NotFoundException, Req } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile/public')
export class PublicProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':username')
  async getPublicProfile(@Param('username') username: string, @Req() req: any) {
    const viewerUserId = req?.user?.sub || req?.user?.id || req?.query?.viewerId;
    const profile = await this.profileService.getPublicProfileByUsername(username, viewerUserId);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    return profile;
  }
}
