import { Module } from '@nestjs/common';
import { WebhooksController } from './controllers/webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WebhooksController]
})
export class WebhooksModule {}
