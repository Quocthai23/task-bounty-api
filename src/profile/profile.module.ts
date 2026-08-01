import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { PublicProfileController } from './public-profile.controller';
import { ProfileService } from './profile.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileController, PublicProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
