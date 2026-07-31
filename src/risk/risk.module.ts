import { Module } from '@nestjs/common';
import { RiskService } from './services/risk.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [RiskService]
})
export class RiskModule {}
