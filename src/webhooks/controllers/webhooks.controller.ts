import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { GithubWebhookGuard } from '../guards/github.guard';
import { GitlabWebhookGuard } from '../guards/gitlab.guard';
import { WebhookResponseDto } from '../dto/webhooks.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-queue') private readonly webhookQueue: Queue
  ) {}

  @ApiOperation({ summary: 'Handle GitHub Webhooks (e.g. push events)' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'GitHub HMAC signature' })
  @ApiResponse({ status: 201, description: 'Webhook received and processed.', type: WebhookResponseDto })
  @UseGuards(GithubWebhookGuard)
  @Post('github')
  async handleGithubWebhook(@Headers('x-github-event') event: string, @Body() payload: any) {
    await this.webhookQueue.add('process-github-event', { event, payload }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return { success: true, message: 'Webhook received and queued' };
  }

  @ApiOperation({ summary: 'Handle GitLab Webhooks (e.g. pipeline events)' })
  @ApiHeader({ name: 'x-gitlab-token', description: 'GitLab Secret Token' })
  @ApiResponse({ status: 201, description: 'Webhook received and processed.', type: WebhookResponseDto })
  @UseGuards(GitlabWebhookGuard)
  @Post('gitlab')
  async handleGitlabWebhook(@Headers('x-gitlab-event') event: string, @Body() payload: any) {
    await this.webhookQueue.add('process-gitlab-event', { event, payload }, {
      attempts: 3, // Tự động thử lại 3 lần nếu lỗi
      backoff: { type: 'exponential', delay: 2000 }, // Delay tăng dần
    });
    return { success: true, message: 'Webhook received and queued' };
  }
}
