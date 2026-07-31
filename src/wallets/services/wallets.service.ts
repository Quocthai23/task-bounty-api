import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { UpdateBankAccountDto, DepositWithdrawDto } from '../dto/wallets.dto';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async updateBankAccount(userId: string, dto: UpdateBankAccountDto) {
    const dataToEncrypt = JSON.stringify(dto);
    const encryptedData = this.encryption.encrypt(dataToEncrypt);
    const maskedData = `**** ${dto.accountNumber.slice(-4)}`;

    return this.prisma.bankAccount.upsert({
      where: { userId },
      update: { encryptedData, maskedData },
      create: { userId, encryptedData, maskedData },
    });
  }

  async getBankAccount(userId: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { userId } });
    if (!account) throw new NotFoundException('Bank account not found');
    
    // In real app, only return maskedData. If need full data, use decrypt
    return { maskedData: account.maskedData };
  }

  async getBalance(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, status: 'COMPLETED' }
    });

    let balance = 0;
    for (const tx of transactions) {
      if (tx.type === 'DEPOSIT' || tx.type === 'PAYOUT') balance += tx.amount;
      if (tx.type === 'WITHDRAW' || tx.type === 'LOCK') balance -= tx.amount;
    }

    return { balance };
  }

  async deposit(userId: string, dto: DepositWithdrawDto) {
    // Replay attack prevention
    await this.ensureUniqueNonce(dto.nonce);

    // Mock Stripe Integration
    // Create transaction in DB
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount: dto.amount,
        currency: dto.currency,
        nonce: dto.nonce,
        status: 'COMPLETED', // auto-complete for mock
        txHash: `mock_stripe_${Date.now()}`
      }
    });
    return tx;
  }

  async withdraw(userId: string, dto: DepositWithdrawDto) {
    // Replay attack prevention
    await this.ensureUniqueNonce(dto.nonce);

    if (!dto.bankAccountId) {
      throw new BadRequestException('bankAccountId is required for withdrawals');
    }

    const { balance } = await this.getBalance(userId);
    if (balance < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAW',
        amount: dto.amount,
        currency: dto.currency,
        nonce: dto.nonce,
        bankAccountId: dto.bankAccountId,
        status: 'COMPLETED',
        txHash: `mock_stripe_out_${Date.now()}`
      }
    });
    return tx;
  }

  async getTransactions(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  private async ensureUniqueNonce(nonce: string) {
    const existing = await this.prisma.transaction.findUnique({ where: { nonce } });
    if (existing) {
      throw new ConflictException('Transaction with this nonce has already been processed (Replay Attack Prevention)');
    }
  }
}
