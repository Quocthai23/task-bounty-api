import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile/public')
export class PublicProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    const profile = await this.profileService.getPublicProfileByUsername(username);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    return profile;
  }
}
