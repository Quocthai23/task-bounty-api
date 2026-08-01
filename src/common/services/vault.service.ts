import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import vault = require('node-vault');

@Injectable()
export class VaultService implements OnModuleInit {
  private readonly logger = new Logger(VaultService.name);
  private vaultClient: vault.client;
  private adminPrivateKey: string;

  constructor() {
    this.vaultClient = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN || 'myroot',
    });
  }

  async onModuleInit() {
    try {
      // Đọc secret từ Vault (đường dẫn ví dụ: secret/data/bounty-app)
      // First, try mounting if it doesn't exist (for dev)
      await this.vaultClient.mounts().catch(() => {});
      await this.vaultClient.mount({ mount_point: 'secret', type: 'kv', options: { version: '2' } }).catch(() => {});
      
      // Seed for dev if needed
      const existing = await this.vaultClient.read('secret/data/bounty-app').catch(() => null);
      if (!existing) {
        await this.vaultClient.write('secret/data/bounty-app', { 
          data: { ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000000' }
        });
      }

      const result = await this.vaultClient.read('secret/data/bounty-app');
      this.adminPrivateKey = result.data.data.ADMIN_PRIVATE_KEY;
      this.logger.log('✅ Vault: Đã tải Private Key an toàn vào RAM.');
    } catch (error) {
      this.logger.error('❌ Vault: Lỗi khi lấy Private Key', error.stack);
      // We do not throw error if we want the app to still start without vault (optional)
      // throw error; 
    }
  }

  getPrivateKey(): string {
    return this.adminPrivateKey;
  }
}
