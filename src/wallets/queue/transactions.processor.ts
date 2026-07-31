import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WalletsService } from '../services/wallets.service';

@Processor('transactions')
export class TransactionsProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionsProcessor.name);

  constructor(private readonly walletsService: WalletsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    
    try {
      if (job.name === 'process-webhook') {
        await this.walletsService.handleWebhookProcessing(job.data);
      } else if (job.name === 'process-blockchain-burn') {
        // Here we could isolate the blockchain interaction logic
        this.logger.log(`Processing blockchain burn for withdrawal`);
      }
      return { success: true };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}
