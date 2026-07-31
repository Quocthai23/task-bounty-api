import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('webhook-queue')
export class WebhookProcessor extends WorkerHost {
  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Đang xử lý Job ID: ${job.id} - Tên: ${job.name}`);
    
    const payload = job.data;
    
    if (job.name === 'process-gitlab-event') {
      // Bắt đầu logic giao tiếp Web3 / Smart Contract ở đây
      const event = payload.event;
      if (event === 'Pipeline Hook') {
        const status = payload.payload?.object_attributes?.status;
        if (status === 'failed') {
          console.log(`GitLab Pipeline failed for project ${payload.payload?.project?.name}`);
          // Handle risk scoring logic for pipeline failures here
        }
      }
    } else if (job.name === 'process-github-event') {
      const event = payload.event;
      if (event === 'push') {
        const commits = payload.payload?.commits || [];
        for (const commit of commits) {
          const match = commit.message.match(/task-([a-zA-Z0-9-]+)/i);
          if (match) {
            const taskId = match[1];
            console.log(`Received GitHub commit for task ${taskId}: ${commit.message}`);
          }
        }
      }
    }
    
    return 'Thành công!';
  }
}
