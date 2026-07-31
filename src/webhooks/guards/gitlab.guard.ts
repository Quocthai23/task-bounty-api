import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GitlabWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['x-gitlab-token'];
    const secret = this.configService.get<string>('GITLAB_WEBHOOK_SECRET');

    if (!secret || !token) {
      throw new UnauthorizedException('Missing GitLab token or secret');
    }

    if (token !== secret) {
      throw new UnauthorizedException('Invalid GitLab token');
    }

    return true;
  }
}
