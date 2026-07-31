import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';
import { MailService } from './mail/mail.service';
import { VaultService } from './services/vault.service';
import { AuditLogService } from './services/audit-log.service';

@Global()
@Module({
  providers: [EncryptionService, MailService, VaultService, AuditLogService],
  exports: [EncryptionService, MailService, VaultService, AuditLogService],
})
export class CommonModule {}
