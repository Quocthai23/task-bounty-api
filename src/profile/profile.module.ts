import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { PublicProfileController } from './public-profile.controller';
import { ProfileService } from './profile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ProfileController, PublicProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
