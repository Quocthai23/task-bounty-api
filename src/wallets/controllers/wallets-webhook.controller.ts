import { Controller, Post, Body, Headers, UnauthorizedException, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { WalletsService } from '../services/wallets.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

@ApiTags('Wallets Webhook')
@Controller('wallets')
export class WalletsWebhookController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
    @InjectQueue('transactions') private readonly transactionsQueue: Queue,
  ) {}

  @ApiOperation({ summary: 'Receive webhook from fiat-bridge to confirm deposits or withdrawals' })
  @HttpCode(HttpStatus.OK)
  @Post('payout-webhook')
  async handlePayoutWebhook(
    @Headers('x-signature') signature: string,
    @Body() payload: any,
    @Req() req: any
  ) {
    const secret = 
      this.configService.get<string>('FIAT_BRIDGE_API_KEY') || 
      this.configService.get<string>('PAYOS_CHECKSUM_KEY') || 
      this.configService.get<string>('HMAC_SECRET') || 
      'my-super-secret-hmac-key';

    if (!signature) {
      throw new UnauthorizedException('Missing signature');
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Push the transaction processing to the BullMQ queue instead of awaiting it here
    await this.transactionsQueue.add('process-webhook', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      }
    });

    return { success: true, queued: true };
  }

  @ApiOperation({ summary: 'Receive webhook from PayOS for deposits' })
  @HttpCode(HttpStatus.OK)
  @Post('payos-webhook')
  async handlePayOSWebhook(@Body() body: any) {
    console.log('🎉 Đã nhận được Webhook từ PayOS:', body);

    try {
      await this.walletsService.processPayOSWebhook(body);
    } catch (e: any) {
      console.error('Lỗi xử lý Webhook PayOS:', e.message || e);
    }

    // Trả về 200 OK để PayOS biết hệ thống của bạn đã nhận được dữ liệu
    return { success: true };
  }
}
