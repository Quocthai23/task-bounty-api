import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { UpdateBankAccountDto, DepositWithdrawDto } from '../dto/wallets.dto';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.walletAddress) return { balance: 0 };
    
    try {
      const rpcUrl = this.configService.get<string>('RPC_URL') || 'https://rpc.ankr.com/eth_sepolia';
      const contractAddress = this.configService.get<string>('CONTRACT_ADDRESS') || '0x0000000000000000000000000000000000000000';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      const abi = ["function balanceOf(address owner) view returns (uint256)"];
      const contract = new ethers.Contract(contractAddress, abi, provider);
      
      const balanceWei = await contract.balanceOf(user.walletAddress);
      const balance = parseFloat(ethers.formatUnits(balanceWei, 6)); 
      
      return { balance };
    } catch (e) {
      console.warn("Blockchain query failed, falling back to DB balance", e.message);
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
  }

  async deposit(userId: string, dto: DepositWithdrawDto) {
    await this.ensureUniqueNonce(dto.nonce);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount: dto.amount,
        currency: dto.currency,
        nonce: dto.nonce,
        status: 'PENDING',
        txHash: `pending_deposit_${Date.now()}`
      }
    });

    const transferMemo = `${user?.id.substring(0, 8).toUpperCase()}`;
    const qrUrl = `https://img.vietqr.io/image/970415-113366668888-compact.png?amount=${dto.amount}&addInfo=${transferMemo}&accountName=TASK BOUNTY`;

    return {
      transaction: tx,
      paymentInstructions: {
        bankName: 'VietinBank',
        accountNumber: '113366668888',
        accountName: 'TASK BOUNTY',
        transferMemo: transferMemo,
        qrCodeUrl: qrUrl
      }
    };
  }

  async withdraw(userId: string, dto: DepositWithdrawDto) {
    await this.ensureUniqueNonce(dto.nonce);

    if (!dto.bankAccountId) {
      throw new BadRequestException('bankAccountId is required for withdrawals');
    }

    const { balance } = await this.getBalance(userId);
    if (balance < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.encryptedPrivateKey) {
      throw new BadRequestException('User wallet not found');
    }

    const privateKey = this.encryption.decrypt(user.encryptedPrivateKey);

    try {
      const rpcUrl = this.configService.get<string>('RPC_URL') || 'https://rpc.ankr.com/eth_sepolia';
      const contractAddress = this.configService.get<string>('CONTRACT_ADDRESS') || '0x0000000000000000000000000000000000000000';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      const abi = ["function burn(uint256 amount)"];
      const contract = new ethers.Contract(contractAddress, abi, wallet);
      
      console.log(`Simulating burn of ${dto.amount} for user ${userId}`);
      
      const tx = await this.prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          amount: dto.amount,
          currency: dto.currency,
          nonce: dto.nonce,
          bankAccountId: dto.bankAccountId,
          status: 'PENDING', 
          txHash: `pending_withdraw_${Date.now()}`
        }
      });
      return tx;
    } catch (e: any) {
      throw new BadRequestException(`Blockchain burn failed: ${e.message}`);
    }
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
