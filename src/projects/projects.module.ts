import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [PrismaModule, NotificationsModule, Web3Module],
  controllers: [ProjectsController],
  providers: [ProjectsService]
})
export class ProjectsModule {}
