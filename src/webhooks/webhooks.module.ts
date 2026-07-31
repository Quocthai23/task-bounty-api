import { Module } from '@nestjs/common';
import { WebhooksController } from './controllers/webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { WebhookProcessor } from './queue/webhook.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'webhook-queue',
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhookProcessor],
})
export class WebhooksModule {}
