import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { VaultService } from '../../common/services/vault.service';
import { ethers } from 'ethers';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function mint(string coreTxId, address to, uint256 amount) returns (bool)',
  'function burn(string coreTxId, address from, uint256 amount) returns (bool)'
];

const CONTRACT_ADDRESSES: Record<string, string> = {
  VND: process.env.CONTRACT_ADDRESS_VND || process.env.CONTRACT_ADDRESS || '0x5fbdb2315678afecb367f032d93f642f64180aa3',
  USD: process.env.CONTRACT_ADDRESS_USD || '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
  EUR: process.env.CONTRACT_ADDRESS_EUR || '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
  JPY: process.env.CONTRACT_ADDRESS_JPY || '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
  CNY: process.env.CONTRACT_ADDRESS_CNY || '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
};

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private provider: ethers.JsonRpcProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly vaultService: VaultService,
  ) {
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Lấy ví ký của Fiat-Bridge (Escrow Vault) từ Admin Private Key
   */
  public getBridgeSigner(): ethers.Wallet {
    const rawKey = this.vaultService.getPrivateKey() || 
                   process.env.ADMIN_PRIVATE_KEY || 
                   'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const cleanKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
    return new ethers.Wallet(cleanKey, this.provider);
  }

  /**
   * Lấy địa chỉ ví Fiat-Bridge
   */
  public getBridgeAddress(): string {
    return this.getBridgeSigner().address;
  }

  /**
   * 1. KHÓA QUỸ (LOCK FUND): Ví PM -> Ví Fiat-Bridge
   */
  async lockFund(pmId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Nhiệm vụ không tồn tại');

    if (task.isEscrowed && task.escrowTxHash) {
      return { 
        success: true, 
        txHash: task.escrowTxHash, 
        message: 'Nhiệm vụ này đã được ký quỹ trên Blockchain trước đó' 
      };
    }

    const budget = Number(task.budget) || 0;
    if (budget <= 0) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { isEscrowed: true }
      });
      return { success: true, txHash: null, message: 'Nhiệm vụ không có ngân sách cần khóa' };
    }

    const pm = await this.prisma.user.findUnique({ where: { id: pmId } });
    if (!pm || !pm.encryptedPrivateKey) {
      throw new BadRequestException('Ví của PM không tồn tại hoặc chưa kích hoạt');
    }

    const currency = (task.project?.currency || 'USD').toUpperCase();
    const tokenAddress = CONTRACT_ADDRESSES[currency] || CONTRACT_ADDRESSES['USD'];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const bridgeSigner = this.getBridgeSigner();
    const fiatBridgeAddress = bridgeSigner.address;

    const pmPrivateKey = this.encryption.decrypt(pm.encryptedPrivateKey);
    const pmSigner = new ethers.Wallet(pmPrivateKey, this.provider);

    const budgetWei = ethers.parseUnits(String(budget), 18);

    this.logger.log(`[LockFund] Task ${taskId}: PM (${pmSigner.address}) -> Fiat-Bridge (${fiatBridgeAddress}) | Amount: ${budget} ${currency}`);

    try {
      // 1. Kiểm tra số dư on-chain của PM
      let pmBal = 0n;
      try {
        pmBal = await tokenContract.balanceOf(pmSigner.address);
      } catch (err: any) {
        this.logger.warn(`Could not fetch on-chain balance for PM ${pmSigner.address}: ${err.message}`);
      }

      // Nếu số dư on-chain của PM không đủ, kiểm tra xem có thể tự động cấp phát cho môi trường thử nghiệm
      if (pmBal < budgetWei) {
        this.logger.warn(`PM balance on-chain (${ethers.formatUnits(pmBal, 18)}) < budget (${budget}).`);
        throw new BadRequestException(
          `Số dư on-chain của bạn (${Number(ethers.formatUnits(pmBal, 18)).toLocaleString()} ${currency}) không đủ để ký quỹ ${budget.toLocaleString()} ${currency}. Vui lòng nạp thêm tiền vào ví!`
        );
      }

      // 2. Chuyển token từ ví PM sang ví Fiat-Bridge
      const tx = await (tokenContract.connect(pmSigner) as any).transfer(fiatBridgeAddress, budgetWei);
      const receipt = await tx.wait(1);
      const realTxHash = receipt?.hash || tx.hash;

      this.logger.log(`[LockFund SUCCESS] TxHash: ${realTxHash}`);

      // 3. Cập nhật Database
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          isEscrowed: true,
          escrowTxHash: realTxHash,
        }
      });

      await this.prisma.transaction.create({
        data: {
          userId: pmId,
          type: 'LOCK',
          amount: budget,
          currency,
          txHash: realTxHash,
          status: 'COMPLETED'
        }
      });

      await this.prisma.userWallet.update({
        where: { userId: pmId },
        data: { lockedEscrow: { increment: budget } }
      }).catch(() => {});

      return {
        success: true,
        txHash: realTxHash,
        message: `Đã khóa quỹ thành công ${budget.toLocaleString()} ${currency} vào Ví Fiat-Bridge (${fiatBridgeAddress})!`
      };
    } catch (error: any) {
      this.logger.error(`[LockFund FAILED] Task ${taskId}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Lỗi khi thực hiện giao dịch khóa quỹ trên Blockchain: ${error.message}`);
    }
  }

  /**
   * 2. NGHIỆM THU & GIẢI NGÂN (APPROVE PAYOUT): Ví Fiat-Bridge -> Ví Dev
   */
  async approvePayout(pmId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, project: true },
    });
    if (!task) throw new NotFoundException('Nhiệm vụ không tồn tại');
    if (!task.assigneeId || !task.assignee) {
      throw new BadRequestException('Nhiệm vụ chưa được giao cho Developer nào');
    }

    const budget = Number(task.budget) || 0;
    if (budget <= 0) {
      return { success: true, txHash: null, message: 'Nhiệm vụ không có ngân sách giải ngân' };
    }

    const dev = task.assignee;
    if (!dev.walletAddress) {
      throw new BadRequestException('Developer chưa có địa chỉ ví On-chain để nhận tiền thưởng');
    }

    const currency = (task.project?.currency || 'USD').toUpperCase();
    const tokenAddress = CONTRACT_ADDRESSES[currency] || CONTRACT_ADDRESSES['USD'];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const bridgeSigner = this.getBridgeSigner();
    const budgetWei = ethers.parseUnits(String(budget), 18);

    this.logger.log(`[ApprovePayout] Task ${taskId}: Fiat-Bridge (${bridgeSigner.address}) -> Dev (${dev.walletAddress}) | Amount: ${budget} ${currency}`);

    try {
      // 1. Kiểm tra số dư ví Fiat-Bridge
      let bridgeBal = 0n;
      try {
        bridgeBal = await tokenContract.balanceOf(bridgeSigner.address);
      } catch (err: any) {
        this.logger.warn(`Could not check Fiat-Bridge balance: ${err.message}`);
      }

      let tx: any;
      // Nếu ví Fiat-Bridge có đủ số dư token ký quỹ
      if (bridgeBal >= budgetWei) {
        tx = await (tokenContract.connect(bridgeSigner) as any).transfer(dev.walletAddress, budgetWei);
      } else {
        // Fallback: Nếu ví bridge thiếu số dư (do PM tạo mock trước đó), Admin có quyền Mint bù cho Dev
        this.logger.warn(`Fiat-Bridge balance low (${ethers.formatUnits(bridgeBal, 18)} < ${budget}), fallback minting to Dev`);
        tx = await (tokenContract.connect(bridgeSigner) as any).mint(`payout_task_${task.id}_${Date.now()}`, dev.walletAddress, budgetWei);
      }

      const receipt = await tx.wait(1);
      const realTxHash = receipt?.hash || tx.hash;

      this.logger.log(`[ApprovePayout SUCCESS] TxHash: ${realTxHash}`);

      // 2. Ghi nhận giao dịch và cập nhật số dư cho Dev
      await this.prisma.transaction.create({
        data: {
          userId: dev.id,
          type: 'PAYOUT',
          amount: budget,
          currency,
          txHash: realTxHash,
          status: 'COMPLETED'
        }
      });

      // Tăng bonusReceived trong ProjectMember
      await this.prisma.projectMember.updateMany({
        where: { projectId: task.projectId, userId: dev.id },
        data: { bonusReceived: { increment: budget } }
      });

      // Giảm lockedEscrow của PM
      if (task.project?.ownerId) {
        await this.prisma.userWallet.update({
          where: { userId: task.project.ownerId },
          data: { lockedEscrow: { decrement: budget } }
        }).catch(() => {});
      }

      return {
        success: true,
        txHash: realTxHash,
        message: `Đã giải ngân ${budget.toLocaleString()} ${currency} từ Ví Fiat-Bridge sang ví Developer (${dev.walletAddress}) thành công!`
      };
    } catch (error: any) {
      this.logger.error(`[ApprovePayout FAILED] Task ${taskId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi giải ngân trên Blockchain: ${error.message}`);
    }
  }

  /**
   * 3. HOÀN CỌC KHI HỦY TASK (REFUND ESCROW): Ví Fiat-Bridge -> Ví PM
   */
  async refundEscrow(pmId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Nhiệm vụ không tồn tại');

    const budget = Number(task.budget) || 0;
    if (!task.isEscrowed || budget <= 0) {
      return { success: true, txHash: null, message: 'Nhiệm vụ chưa ký quỹ hoặc không có ngân sách hoàn trả' };
    }

    const pm = await this.prisma.user.findUnique({ where: { id: pmId } });
    if (!pm || !pm.walletAddress) {
      throw new BadRequestException('Ví của PM không tồn tại');
    }

    const currency = (task.project?.currency || 'USD').toUpperCase();
    const tokenAddress = CONTRACT_ADDRESSES[currency] || CONTRACT_ADDRESSES['USD'];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const bridgeSigner = this.getBridgeSigner();
    const budgetWei = ethers.parseUnits(String(budget), 18);

    this.logger.log(`[RefundEscrow] Task ${taskId}: Fiat-Bridge (${bridgeSigner.address}) -> PM (${pm.walletAddress}) | Amount: ${budget} ${currency}`);

    try {
      const tx = await (tokenContract.connect(bridgeSigner) as any).transfer(pm.walletAddress, budgetWei);
      const receipt = await tx.wait(1);
      const realTxHash = receipt?.hash || tx.hash;

      this.logger.log(`[RefundEscrow SUCCESS] TxHash: ${realTxHash}`);

      // Cập nhật Database
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          isEscrowed: false,
          escrowTxHash: null,
        }
      });

      await this.prisma.transaction.create({
        data: {
          userId: pmId,
          type: 'REFUND',
          amount: budget,
          currency,
          txHash: realTxHash,
          status: 'COMPLETED'
        }
      });

      await this.prisma.userWallet.update({
        where: { userId: pmId },
        data: { lockedEscrow: { decrement: budget } }
      }).catch(() => {});

      return {
        success: true,
        txHash: realTxHash,
        message: `Đã hoàn trả ${budget.toLocaleString()} ${currency} từ Ví Fiat-Bridge về ví PM (${pm.walletAddress}) thành công!`
      };
    } catch (error: any) {
      this.logger.error(`[RefundEscrow FAILED] Task ${taskId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi hoàn tiền ký quỹ trên Blockchain: ${error.message}`);
    }
  }

  /**
   * Chuyển Token trực tiếp On-chain giữa 2 người dùng (ví dụ: PM thưởng Bonus trực tiếp cho Member)
   */
  async transferDirectToken(senderUserId: string, recipientAddress: string, amount: number, currency: string = 'USD') {
    const sender = await this.prisma.user.findUnique({ where: { id: senderUserId } });
    if (!sender || !sender.encryptedPrivateKey) {
      throw new BadRequestException('Ví người gửi không tồn tại hoặc chưa kích hoạt');
    }

    const cur = currency.toUpperCase();
    const tokenAddress = CONTRACT_ADDRESSES[cur] || CONTRACT_ADDRESSES['USD'];
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const senderPrivateKey = this.encryption.decrypt(sender.encryptedPrivateKey);
    const senderSigner = new ethers.Wallet(senderPrivateKey, this.provider);
    const amountWei = ethers.parseUnits(String(amount), 18);

    // Kiểm tra số dư On-chain của sender
    let senderBal = 0n;
    try {
      senderBal = await tokenContract.balanceOf(senderSigner.address);
    } catch (err: any) {
      this.logger.warn(`Could not check sender balance: ${err.message}`);
    }

    if (senderBal < amountWei) {
      throw new BadRequestException(
        `Số dư On-chain của bạn (${Number(ethers.formatUnits(senderBal, 18)).toLocaleString()} ${cur}) không đủ để thưởng ${amount.toLocaleString()} ${cur}!`
      );
    }

    try {
      const tx = await (tokenContract.connect(senderSigner) as any).transfer(recipientAddress, amountWei);
      const receipt = await tx.wait(1);
      const realTxHash = receipt?.hash || tx.hash;

      this.logger.log(`[TransferDirectToken SUCCESS] ${senderSigner.address} -> ${recipientAddress} | Amount: ${amount} ${cur} | TxHash: ${realTxHash}`);
      return { success: true, txHash: realTxHash };
    } catch (err: any) {
      this.logger.error(`[TransferDirectToken FAILED]: ${err.message}`, err.stack);
      throw new BadRequestException(`Lỗi khi chuyển token trên Blockchain: ${err.message}`);
    }
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
