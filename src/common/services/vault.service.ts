import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as nodeVault from 'node-vault';

@Injectable()
export class VaultService implements OnModuleInit {
  private readonly logger = new Logger(VaultService.name);
  private vaultClient: nodeVault.client;

  constructor() {
    this.vaultClient = nodeVault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
      token: process.env.VAULT_TOKEN || 'myroot',
    });
  }

  async onModuleInit() {
    try {
      // In dev mode, we mount a KV store if it doesn't exist
      await this.vaultClient.mounts().catch(() => {});
      // Ensure kv secret engine is mounted at secret/
      await this.vaultClient.mount({ mount_point: 'secret', type: 'kv', options: { version: '2' } }).catch(() => {});
      
      // Initialize with default admin key if not present (for development convenience)
      const existing = await this.getSecret('admin-wallet').catch(() => null);
      if (!existing) {
        await this.setSecret('admin-wallet', {
          privateKey: process.env.ADMIN_PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000000'
        });
        this.logger.log('Initialized Vault with default admin wallet key for dev.');
      }
      this.logger.log('Vault service initialized successfully.');
    } catch (error) {
      this.logger.warn(`Failed to connect to Vault: ${error.message}. Is Vault running?`);
    }
  }

  async getSecret(path: string): Promise<any> {
    try {
      // KV v2 stores data under data/
      const result = await this.vaultClient.read(`secret/data/${path}`);
      return result.data.data;
    } catch (error) {
      this.logger.error(`Error reading secret from vault: ${error.message}`);
      throw error;
    }
  }

  async setSecret(path: string, data: any): Promise<void> {
    try {
      await this.vaultClient.write(`secret/data/${path}`, { data });
    } catch (error) {
      this.logger.error(`Error writing secret to vault: ${error.message}`);
      throw error;
    }
  }
}
