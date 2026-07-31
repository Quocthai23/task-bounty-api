import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { GithubWebhookGuard } from '../guards/github.guard';
import { GitlabWebhookGuard } from '../guards/gitlab.guard';
import { WebhookResponseDto } from '../dto/webhooks.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Handle GitHub Webhooks (e.g. push events)' })
  @ApiHeader({ name: 'x-hub-signature-256', description: 'GitHub HMAC signature' })
  @ApiResponse({ status: 201, description: 'Webhook received and processed.', type: WebhookResponseDto })
  @UseGuards(GithubWebhookGuard)
  @Post('github')
  async handleGithubWebhook(@Headers('x-github-event') event: string, @Body() payload: any) {
    if (event === 'push') {
      const commits = payload.commits || [];
      const isCiFail = payload.ci_status === 'failed'; // mock
      
      for (const commit of commits) {
        const match = commit.message.match(/task-([a-zA-Z0-9-]+)/i);
        if (match) {
          const taskId = match[1];
          console.log(`Received GitHub commit for task ${taskId}: ${commit.message}`);
        }
      }
    }
    return { success: true };
  }

  @ApiOperation({ summary: 'Handle GitLab Webhooks (e.g. pipeline events)' })
  @ApiHeader({ name: 'x-gitlab-token', description: 'GitLab Secret Token' })
  @ApiResponse({ status: 201, description: 'Webhook received and processed.', type: WebhookResponseDto })
  @UseGuards(GitlabWebhookGuard)
  @Post('gitlab')
  async handleGitlabWebhook(@Headers('x-gitlab-event') event: string, @Body() payload: any) {
    if (event === 'Pipeline Hook') {
      const status = payload.object_attributes?.status;
      if (status === 'failed') {
        console.log(`GitLab Pipeline failed for project ${payload.project?.name}`);
        // Handle risk scoring logic for pipeline failures here
      }
    }
    return { success: true };
  }
}
