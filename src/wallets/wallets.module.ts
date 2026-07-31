import { Module } from '@nestjs/common';
import { WalletsController } from './controllers/wallets.controller';
import { WalletsWebhookController } from './controllers/wallets-webhook.controller';
import { WalletsService } from './services/wallets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TransactionsProcessor } from './queue/transactions.processor';

@Module({
  imports: [
    PrismaModule, 
    CommonModule, 
    ConfigModule,
    BullModule.registerQueue({
      name: 'transactions',
    }),
  ],
  controllers: [WalletsController, WalletsWebhookController],
  providers: [WalletsService, TransactionsProcessor]
})
export class WalletsModule {}
