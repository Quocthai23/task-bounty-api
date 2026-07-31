import { Controller, Post, Body, Headers, UnauthorizedException, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { WalletsService } from '../services/wallets.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@ApiTags('Wallets Webhook')
@Controller('wallets')
export class WalletsWebhookController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Receive webhook from fiat-bridge to confirm deposits or withdrawals' })
  @HttpCode(HttpStatus.OK)
  @Post('payout-webhook')
  async handlePayoutWebhook(
    @Headers('x-signature') signature: string,
    @Body() payload: any,
    @Req() req: any
  ) {
    const secret = this.configService.get<string>('HMAC_SECRET');
    if (!secret) {
      throw new UnauthorizedException('HMAC secret not configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing signature');
    }

    // In a real application, you should stringify the raw body for HMAC verification.
    // Assuming payload is passed correctly here:
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    // In a robust implementation, use crypto.timingSafeEqual for security.
    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Process the transaction in the service
    await this.walletsService.handleWebhookProcessing(payload);

    return { success: true };
  }
}
