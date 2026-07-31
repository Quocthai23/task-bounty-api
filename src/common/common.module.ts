import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';
import { MailService } from './mail/mail.service';

@Module({
  providers: [EncryptionService, MailService],
  exports: [EncryptionService, MailService]
})
export class CommonModule {}
