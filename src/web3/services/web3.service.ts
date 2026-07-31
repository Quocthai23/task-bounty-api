import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { ethers } from 'ethers';

@Injectable()
export class Web3Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async lockFund(pmId: string, taskId: string) {
    const pm = await this.prisma.user.findUnique({ where: { id: pmId } });
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    
    if (!pm || !pm.encryptedPrivateKey) throw new BadRequestException('Wallet not found for PM');
    if (!task) throw new NotFoundException('Task not found');
    
    const privateKey = this.encryption.decrypt(pm.encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey);

    // Mock Web3 Escrow Lock
    const mockTxHash = `0xlock_${Date.now()}_${wallet.address}`;
    
    // Save transaction
    await this.prisma.transaction.create({
      data: {
        userId: pmId,
        type: 'LOCK',
        amount: task.budget,
        txHash: mockTxHash,
        status: 'COMPLETED'
      }
    });

    return { success: true, txHash: mockTxHash, message: 'Funds locked in Escrow' };
  }

  async approvePayout(pmId: string, taskId: string) {
    const pm = await this.prisma.user.findUnique({ where: { id: pmId } });
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { assignee: true } });
    
    if (!pm || !pm.encryptedPrivateKey) throw new BadRequestException('Wallet not found for PM');
    if (!task || !task.assignee) throw new NotFoundException('Task or Assignee not found');
    
    const privateKey = this.encryption.decrypt(pm.encryptedPrivateKey);
    const pmWallet = new ethers.Wallet(privateKey);

    // Mock Web3 Escrow Release to Dev
    const mockTxHash = `0xpayout_${Date.now()}_to_${task.assignee.walletAddress}`;
    
    // Save transaction for Dev
    await this.prisma.transaction.create({
      data: {
        userId: task.assignee.id,
        type: 'PAYOUT',
        amount: task.budget,
        txHash: mockTxHash,
        status: 'PENDING'
      }
    });

    return { success: true, txHash: mockTxHash, message: 'Payout approved to Dev, waiting for blockchain sync' };
  }

  async syncTransaction(dto: any) {
    const tx = await this.prisma.transaction.findFirst({
      where: { txHash: dto.txHash }
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: { status: dto.status }
    });

    return { success: true, message: `Transaction status updated to ${dto.status}` };
  }
}
