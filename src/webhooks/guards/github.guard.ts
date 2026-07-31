import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class GithubWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const signature = req.headers['x-hub-signature-256'];
    const secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');

    if (!secret || !signature) {
      throw new UnauthorizedException('Missing signature or secret');
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(req.rawBody || '').digest('hex');

    if (signature !== digest) {
      throw new UnauthorizedException('Invalid GitHub signature');
    }

    return true;
  }
}
