import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UpdateBankAccountDto, DepositWithdrawDto, GrantCreditDto, SwapCurrencyDto } from '../dto/wallets.dto';
import { ethers } from 'ethers';
import { PayOS } from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { ExchangeRatesService } from './exchange-rates.service';

@Injectable()
export class WalletsService {
  private payos: PayOS;
  private readonly contractAddresses: Record<string, string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly notificationsService: NotificationsService,
  ) {
    const checksumKey = 
      this.configService.get<string>('PAYOS_CHECKSUM_KEY') || 
      this.configService.get<string>('HMAC_SECRET') || 
      '';

    this.payos = new PayOS({
      clientId: this.configService.get<string>('PAYOS_CLIENT_ID') || '',
      apiKey: this.configService.get<string>('PAYOS_API_KEY') || '',
      checksumKey: checksumKey
    });

    this.contractAddresses = {
      VND: this.configService.get<string>('CONTRACT_ADDRESS_VND') || this.configService.get<string>('CONTRACT_ADDRESS') || '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      USD: this.configService.get<string>('CONTRACT_ADDRESS_USD') || '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
      EUR: this.configService.get<string>('CONTRACT_ADDRESS_EUR') || '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
      JPY: this.configService.get<string>('CONTRACT_ADDRESS_JPY') || '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
      CNY: this.configService.get<string>('CONTRACT_ADDRESS_CNY') || '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
    };
  }

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
    if (!account) return { bankName: '', accountNumber: '', maskedData: 'Chưa liên kết ngân hàng' };
    
    try {
      const decrypted = JSON.parse(this.encryption.decrypt(account.encryptedData));
      return {
        bankName: decrypted.bankName || '',
        accountNumber: decrypted.accountNumber || '',
        maskedData: account.maskedData || `**** ${decrypted.accountNumber?.slice(-4)}`
      };
    } catch {
      return { bankName: '', accountNumber: '', maskedData: account.maskedData };
    }
  }

  /**
   * Dual-Balance Ledger:
   * 1. On-Chain Verified Balance (Smart Contract ERC20 balanceOf - 100% Fiat-Backed, Withdrawable)
   * 2. System Credit (Off-Chain PostgreSQL - Bonus / Promotional / Internal adjustments, Non-withdrawable)
   */
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      include: { wallet: true }
    });

    const emptyBalances: Record<string, number> = { VND: 0, USD: 0, EUR: 0, JPY: 0, CNY: 0 };
    if (!user || !user.walletAddress) {
      return { 
        balance: 0, 
        onChainBalance: 0, 
        systemCredit: 0, 
        lockedEscrow: 0, 
        balances: emptyBalances,
        breakdown: this.createEmptyBreakdown()
      };
    }

    const systemCredit = user.wallet?.systemCredits || 0;
    const lockedEscrow = user.wallet?.lockedEscrow || 0;
    const walletCurrency = user.wallet?.currency || 'VND';

    const onChainBalances: Record<string, number> = { ...emptyBalances };

    try {
      const rpcUrl = this.configService.get<string>('RPC_URL') || 'http://127.0.0.1:8545';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const abi = ['function balanceOf(address owner) view returns (uint256)'];

      await Promise.all(
        Object.entries(this.contractAddresses).map(async ([curr, addr]) => {
          try {
            const contract = new ethers.Contract(addr, abi, provider);
            const balanceWei = await contract.balanceOf(user.walletAddress);
            onChainBalances[curr] = parseFloat(ethers.formatUnits(balanceWei, 18));
          } catch {
            onChainBalances[curr] = 0;
          }
        }),
      );
    } catch (e: any) {
      console.warn('Blockchain multi-currency query failed, falling back to DB ledger:', e.message);
      const transactions = await this.prisma.transaction.findMany({
        where: { userId, status: 'COMPLETED' },
      });
      for (const tx of transactions) {
        const curr = (tx.currency || 'VND').toUpperCase();
        if (!onChainBalances[curr]) onChainBalances[curr] = 0;
        if (tx.type === 'DEPOSIT' || tx.type === 'PAYOUT') onChainBalances[curr] += tx.amount;
        if (tx.type === 'WITHDRAW' || tx.type === 'LOCK') onChainBalances[curr] -= tx.amount;
        if (tx.type === 'SWAP') {
          const src = (tx.sourceCurrency || tx.currency).toUpperCase();
          const tgt = (tx.targetCurrency || 'VND').toUpperCase();
          if (!onChainBalances[src]) onChainBalances[src] = 0;
          if (!onChainBalances[tgt]) onChainBalances[tgt] = 0;
          onChainBalances[src] -= tx.amount;
          onChainBalances[tgt] += (tx.targetAmount || 0);
        }
      }
    }

    // Build breakdown for each currency
    const breakdown: Record<string, any> = {};
    const totalBalances: Record<string, number> = {};

    for (const [curr, onChain] of Object.entries(onChainBalances)) {
      const creditForCurr = (curr === walletCurrency) ? systemCredit : 0;
      const lockedForCurr = (curr === walletCurrency) ? lockedEscrow : 0;
      const total = onChain + creditForCurr;

      breakdown[curr] = {
        onChain,
        systemCredit: creditForCurr,
        lockedEscrow: lockedForCurr,
        total,
      };
      totalBalances[curr] = total;
    }

    const primaryCurr = 'VND';
    const primaryOnChain = onChainBalances[primaryCurr] || onChainBalances['USD'] || 0;
    const primaryTotal = (totalBalances[primaryCurr] || totalBalances['USD'] || 0);

    return {
      balance: primaryTotal,
      onChainBalance: primaryOnChain,
      systemCredit,
      lockedEscrow,
      balances: totalBalances,
      breakdown,
    };
  }

  private createEmptyBreakdown() {
    const currencies = ['VND', 'USD', 'EUR', 'JPY', 'CNY'];
    const res: Record<string, any> = {};
    for (const c of currencies) {
      res[c] = { onChain: 0, systemCredit: 0, lockedEscrow: 0, total: 0 };
    }
    return res;
  }

  async deposit(userId: string, dto: DepositWithdrawDto) {
    await this.ensureUniqueNonce(dto.nonce);

    const currency = (dto.currency || 'VND').toUpperCase();
    const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'));

    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount: dto.amount,
        currency,
        nonce: dto.nonce,
        status: 'PENDING',
        txHash: `deposit_${currency}_${orderCode}`,
      },
    });

    if (currency === 'VND') {
      const requestData = {
        orderCode: orderCode,
        amount: dto.amount,
        description: `TB ${orderCode}`,
        returnUrl: 'http://localhost:5173/wallet',
        cancelUrl: 'http://localhost:5173/wallet',
      };

      try {
        const paymentLink = await this.payos.paymentRequests.create(requestData);
        return {
          transaction: tx,
          paymentInstructions: {
            currency,
            bankName: paymentLink.bin || 'MB Bank',
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
            transferMemo: paymentLink.description || requestData.description,
            description: paymentLink.description || requestData.description,
            amount: paymentLink.amount || dto.amount,
            qrCodeUrl: '',
            qrCodeData: paymentLink.qrCode,
            qrCode: paymentLink.qrCode,
            checkoutUrl: paymentLink.checkoutUrl,
          },
        };
      } catch (error: any) {
        console.error('PayOS createPaymentLink error:', error?.response?.data || error.message || error);
        throw new BadRequestException('Failed to create PayOS payment link: ' + (error?.response?.data?.message || error.message));
      }
    } else {
      // Global multi-currency simulated wire / instant gateway
      const memo = `TB-${currency}-${orderCode}`;
      return {
        transaction: tx,
        paymentInstructions: {
          currency,
          bankName: `Global ${currency} Gateway (Standard Chartered)`,
          accountNumber: '9988223311',
          accountName: 'TASK BOUNTY MULTI-CURRENCY ESCROW',
          transferMemo: memo,
          qrCodeUrl: '',
          qrCodeData: `https://task-bounty.io/pay?curr=${currency}&amt=${dto.amount}&memo=${memo}`,
          checkoutUrl: '',
        },
      };
    }
  }

  /**
   * Processes webhook notifications from PayOS for VND fiat deposits.
   * Matches pending transactions flexibly by orderCode and triggers on-chain mint via fiat-bridge.
   */
  async processPayOSWebhook(body: any) {
    try {
      const webhookData = await this.payos.webhooks.verify(body);

      if (webhookData) {
        const orderCode = webhookData.orderCode;

        // Flexible query matching deposit_VND_${orderCode}, deposit_${orderCode}, or soft contains
        const tx = await this.prisma.transaction.findFirst({
          where: {
            OR: [
              { txHash: `deposit_VND_${orderCode}` },
              { txHash: `deposit_${orderCode}` },
              { txHash: { contains: String(orderCode) } },
              { txHash: `payos_${orderCode}` },
            ],
            status: 'PENDING',
          },
          include: { user: true },
        });

        if (tx) {
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: { status: 'COMPLETED' },
          });
          console.log(`✅ Giao dịch ${tx.id} (Order ${orderCode}) đã COMPLETED`);

          // Send Deposit Notification & Activity Log
          await this.notificationsService.notifyDepositSuccess(
            tx.userId,
            tx.amount,
            tx.currency || 'VND',
            tx.txHash || undefined
          );

          // GỌI FIAT-BRIDGE HOẶC DIRECT EVM ĐỂ MINT TOKEN ON-CHAIN
          let mintSuccess = false;
          try {
            if (!tx.user?.walletAddress) {
              console.warn(`User ${tx.userId} does not have a wallet address to mint to.`);
            } else {
              const bridgeUrl = this.configService.get<string>('FIAT_BRIDGE_URL') || 'http://localhost:8080';
              const bridgeApiKey = this.configService.get<string>('FIAT_BRIDGE_API_KEY') || '7afff93f725d94800318faeeb8c7662b6b57c6cb45f3ee3fcbf8df2d5150bb02';
              const currency = (tx.currency || 'VND').toUpperCase();
              const mintPayload = {
                core_tx_id: `payos_${orderCode}`,
                user_address: tx.user.walletAddress,
                amount: ethers.parseUnits(String(tx.amount), 18).toString(),
                currency,
              };

              const response = await axios.post(`${bridgeUrl}/api/v1/bridge/mint`, mintPayload, {
                headers: {
                  'X-API-Key': bridgeApiKey,
                },
                timeout: 3000,
              });
              mintSuccess = true;
              console.log(`✅ [Fiat-Bridge] Đã gửi lệnh Mint (${currency}) tới fiat-bridge:`, response.data);
            }
          } catch (bridgeError: any) {
            console.warn(`⚠️ Fiat-Bridge mint unavailable (${bridgeError.message}), fallback sang Direct EVM Node...`);
          }

          if (!mintSuccess && tx.user?.walletAddress) {
            try {
              const currency = (tx.currency || 'VND').toUpperCase();
              const contractAddr = this.contractAddresses[currency] || this.contractAddresses['VND'];
              if (contractAddr) {
                const rpcUrl = this.configService.get<string>('RPC_URL') || 'http://127.0.0.1:8545';
                const adminKey = this.configService.get<string>('ADMIN_PRIVATE_KEY') || 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const signer = new ethers.Wallet(adminKey, provider);
                const abi = ['function mint(string _coreTxId, address _to, uint256 _amount) external'];
                const contract = new ethers.Contract(contractAddr, abi, signer);
                const nonce = await provider.getTransactionCount(signer.address, 'latest');
                const mintTx = await contract.mint(`payos_${orderCode}`, tx.user.walletAddress, ethers.parseUnits(String(tx.amount), 18), { nonce });
                await mintTx.wait(1);
                console.log(`✅ [Direct-EVM] Đã mint ${tx.amount} ${currency} cho ví ${tx.user.walletAddress}`);
              }
            } catch (evmErr: any) {
              console.error(`⚠️ Lỗi direct EVM mint:`, evmErr.message);
            }
          }
        } else {
          console.warn(`⚠️ Không tìm thấy giao dịch PENDING cho OrderCode ${orderCode}`);
        }
      }
    } catch (e: any) {
      console.error('Lỗi xác thực PayOS webhook data:', e.message || e);
      throw e;
    }
  }

  /**
   * Withdraw funds: Enforces Zero-Loss Protection.
   * Supports 2 withdrawal methods:
   * 1. BANK: Burns token and registers pending bank payout.
   * 2. WALLET: Transfers/Mints directly to recipient wallet address on-chain.
   */
  async withdraw(userId: string, dto: DepositWithdrawDto) {
    await this.ensureUniqueNonce(dto.nonce);

    const isWalletTransfer = dto.method === 'WALLET' || Boolean(dto.targetAddress);
    let bankAccountId = dto.bankAccountId;

    if (isWalletTransfer) {
      if (!dto.targetAddress || !ethers.isAddress(dto.targetAddress)) {
        throw new BadRequestException('Địa chỉ ví đích (0x...) không hợp lệ. Vui lòng kiểm tra lại.');
      }
    } else {
      if (!bankAccountId || bankAccountId === 'default') {
        const bankAcc = await this.prisma.bankAccount.findUnique({ where: { userId } });
        if (!bankAcc) {
          throw new BadRequestException('Vui lòng liên kết tài khoản ngân hàng trước khi thực hiện rút tiền về ngân hàng');
        }
        bankAccountId = bankAcc.id;
      }
    }

    const currency = (dto.currency || 'VND').toUpperCase();
    const balanceInfo = await this.getBalance(userId);
    const onChainAvailable = balanceInfo.breakdown?.[currency]?.onChain ?? 0;

    // Strict validation: Only allow withdrawing up to verified on-chain funds
    if (onChainAvailable < dto.amount) {
      throw new BadRequestException(
        `Số dư khả dụng ${currency} không đủ. Khả dụng: ${onChainAvailable}, Yêu cầu rút/chuyển: ${dto.amount}. Lưu ý: Điểm thưởng nội bộ không thể rút.`
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.walletAddress) {
      throw new BadRequestException('Không tìm thấy tài khoản ví định danh của người dùng');
    }

    const bridgeUrl = this.configService.get<string>('FIAT_BRIDGE_URL') || 'http://localhost:8080';
    const bridgeApiKey = this.configService.get<string>('FIAT_BRIDGE_API_KEY') || '7afff93f725d94800318faeeb8c7662b6b57c6cb45f3ee3fcbf8df2d5150bb02';

    if (isWalletTransfer) {
      const tx = await this.prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          amount: dto.amount,
          currency,
          nonce: dto.nonce,
          bankAccountId: null,
          status: 'COMPLETED',
          txHash: `to_${dto.targetAddress}`,
        },
      });

      let bridgeSuccess = false;
      try {
        // Step 1: Burn from sender's wallet
        const burnPayload = {
          core_tx_id: `transfer_burn_${tx.id}`,
          user_address: user.walletAddress,
          amount: ethers.parseUnits(String(dto.amount), 18).toString(),
          currency,
        };
        await axios.post(`${bridgeUrl}/api/v1/bridge/burn`, burnPayload, {
          headers: { 'X-API-Key': bridgeApiKey },
          timeout: 3000,
        });

        // Step 2: Mint to destination wallet
        const mintPayload = {
          core_tx_id: `transfer_mint_${tx.id}`,
          user_address: dto.targetAddress,
          amount: ethers.parseUnits(String(dto.amount), 18).toString(),
          currency,
        };
        await axios.post(`${bridgeUrl}/api/v1/bridge/mint`, mintPayload, {
          headers: { 'X-API-Key': bridgeApiKey },
          timeout: 3000,
        });

        bridgeSuccess = true;
        console.log(`✅ Chuyển thành công ${dto.amount} ${currency} từ ${user.walletAddress} tới ví ${dto.targetAddress}`);
      } catch (bridgeError: any) {
        console.warn(`⚠️ Warning: fiat-bridge transfer call:`, bridgeError.message);
      }

      if (!bridgeSuccess) {
        try {
          const rpcUrl = this.configService.get<string>('RPC_URL') || 'http://127.0.0.1:8545';
          const adminKey = this.configService.get<string>('ADMIN_PRIVATE_KEY') || 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const signer = new ethers.Wallet(adminKey, provider);
          const contractAddr = this.contractAddresses[currency];
          if (contractAddr) {
            const abi = [
              'function burn(string _coreTxId, address _from, uint256 _amount) external',
              'function mint(string _coreTxId, address _to, uint256 _amount) external',
            ];
            const contract = new ethers.Contract(contractAddr, abi, signer);
            const burnNonce = await provider.getTransactionCount(signer.address, 'latest');
            const burnTx = await contract.burn(`transfer_burn_${tx.id}`, user.walletAddress, ethers.parseUnits(String(dto.amount), 18), { nonce: burnNonce });
            await burnTx.wait(1);

            const mintNonce = await provider.getTransactionCount(signer.address, 'latest');
            const mintTx = await contract.mint(`transfer_mint_${tx.id}`, dto.targetAddress, ethers.parseUnits(String(dto.amount), 18), { nonce: mintNonce });
            await mintTx.wait(1);
            console.log(`✅ [Direct-EVM] Đã chuyển ${dto.amount} ${currency} từ ${user.walletAddress} tới ví ${dto.targetAddress}`);
          }
        } catch (evmErr: any) {
          console.error(`⚠️ Direct EVM transfer error:`, evmErr.message);
        }
      }

      await this.notificationsService.notifyWithdrawal(
        userId,
        dto.amount,
        currency,
        dto.targetAddress ? `Ví ${dto.targetAddress.slice(0, 6)}...${dto.targetAddress.slice(-4)}` : 'Ví điện tử',
        'COMPLETED'
      );

      return tx;
    } else {
      // Check if this is a Cross-Currency Burn-to-Payout request (e.g. Burn USD -> Payout VND)
      let targetAmount = dto.amount;
      let exchangeRate = 1.0;
      let targetCurrency = currency;
      let quoteId = dto.quoteId;

      if (dto.quoteId || (dto.sourceCurrency && dto.targetCurrency && dto.sourceCurrency !== dto.targetCurrency)) {
        const srcCurr = (dto.sourceCurrency || currency).toUpperCase();
        const tgtCurr = (dto.targetCurrency || 'VND').toUpperCase();

        if (dto.quoteId) {
          const validatedQuote = await this.exchangeRatesService.validateAndConsumeQuote(
            userId,
            dto.quoteId,
            srcCurr,
            tgtCurr,
            dto.amount,
          );
          targetAmount = validatedQuote.targetAmount;
          exchangeRate = validatedQuote.exchangeRate;
          targetCurrency = tgtCurr;
          quoteId = validatedQuote.id;
        } else {
          // Fallback quote generation if not pre-locked
          exchangeRate = await this.exchangeRatesService.getCrossRate(srcCurr, tgtCurr);
          targetAmount = Math.round((dto.amount * exchangeRate) * 100) / 100;
          targetCurrency = tgtCurr;
        }
      }

      // Fetch user's decrypted bank account info for payout dispatch
      let bankInfo = { bankName: 'Vietcombank', accountNumber: '' };
      const bankAcc = await this.prisma.bankAccount.findUnique({ where: { userId } });
      if (bankAcc && bankAcc.encryptedData) {
        try {
          const decrypted = JSON.parse(this.encryption.decrypt(bankAcc.encryptedData));
          bankInfo = {
            bankName: decrypted.bankName || 'Vietcombank',
            accountNumber: decrypted.accountNumber || '',
          };
        } catch {
          // fallback
        }
      }

      const tx = await this.prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAW',
          amount: dto.amount,
          currency,
          sourceCurrency: currency,
          targetCurrency,
          targetAmount,
          exchangeRate,
          quoteId,
          nonce: dto.nonce,
          bankAccountId,
          status: 'PENDING',
          txHash: `pending_bank_${currency}_to_${targetCurrency}_${Date.now()}`,
        },
      });

      // Invoke fiat-bridge burn/cross-burn endpoint to execute on-chain burn
      let burnSuccess = false;
      try {
        const isCrossCurrency = currency !== targetCurrency;
        const bridgeEndpoint = isCrossCurrency ? `${bridgeUrl}/api/v1/bridge/cross-burn` : `${bridgeUrl}/api/v1/bridge/burn`;
        
        const payload = isCrossCurrency
          ? {
              core_tx_id: `withdraw_cross_${tx.id}`,
              user_address: user.walletAddress,
              burn_currency: currency,
              burn_amount: ethers.parseUnits(String(dto.amount), 18).toString(),
              payout_currency: targetCurrency,
              payout_amount: String(targetAmount),
              bank_name: bankInfo.bankName,
              account_number: bankInfo.accountNumber,
            }
          : {
              core_tx_id: `withdraw_${tx.id}`,
              user_address: user.walletAddress,
              amount: ethers.parseUnits(String(dto.amount), 18).toString(),
              currency,
            };

        const response = await axios.post(bridgeEndpoint, payload, {
          headers: { 'X-API-Key': bridgeApiKey },
          timeout: 3000,
        });

        burnSuccess = true;
        console.log(`✅ Đã gửi lệnh Rút ngân hàng (${currency} -> ${targetCurrency}) tới fiat-bridge:`, response.data);
      } catch (bridgeError: any) {
        console.warn(`⚠️ Warning: fiat-bridge burn call returned:`, bridgeError.message);
      }

      if (!burnSuccess) {
        try {
          const rpcUrl = this.configService.get<string>('RPC_URL') || 'http://127.0.0.1:8545';
          const adminKey = this.configService.get<string>('ADMIN_PRIVATE_KEY') || 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const signer = new ethers.Wallet(adminKey, provider);
          const contractAddr = this.contractAddresses[currency];
          if (contractAddr) {
            const abi = ['function burn(string _coreTxId, address _from, uint256 _amount) external'];
            const contract = new ethers.Contract(contractAddr, abi, signer);
            const nonce = await provider.getTransactionCount(signer.address, 'latest');
            const burnTx = await contract.burn(`withdraw_${tx.id}`, user.walletAddress, ethers.parseUnits(String(dto.amount), 18), { nonce });
            await burnTx.wait(1);
            console.log(`✅ [Direct-EVM] Đã đốt ${dto.amount} ${currency} khỏi ví ${user.walletAddress} cho yêu cầu rút ngân hàng`);
          }
        } catch (evmErr: any) {
          console.error(`⚠️ Direct EVM burn error on bank withdrawal:`, evmErr.message);
        }
      }

      await this.notificationsService.notifyWithdrawal(
        userId,
        dto.amount,
        currency,
        bankInfo.accountNumber ? `${bankInfo.bankName} (****${bankInfo.accountNumber.slice(-4)})` : 'Ngân hàng',
        'PENDING'
      );

      return tx;
    }
  }

  /**
   * Returns Treasury Liquidity Status: Real-time Inflow vs Outflow tracking & Low Liquidity Alert.
   */
  async getTreasuryStatus() {
    // 1. Calculate USD Inflow (Total USD Deposited)
    const usdDeposits = await this.prisma.transaction.aggregate({
      where: {
        type: 'DEPOSIT',
        currency: 'USD',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });
    const totalUsdInflow = usdDeposits._sum.amount || 0;

    // 2. Calculate VND Outflow (Total VND paid out to devs)
    const vndWithdrawals = await this.prisma.transaction.aggregate({
      where: {
        type: 'WITHDRAW',
        OR: [
          { targetCurrency: 'VND' },
          { currency: 'VND' },
        ],
        status: 'COMPLETED',
      },
      _sum: {
        targetAmount: true,
        amount: true,
      },
    });
    const totalVndOutflow = (vndWithdrawals._sum.targetAmount ?? vndWithdrawals._sum.amount) || 0;

    // 3. VND Inflow (Direct VND deposits via PayOS)
    const vndDeposits = await this.prisma.transaction.aggregate({
      where: {
        type: 'DEPOSIT',
        currency: 'VND',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });
    const totalVndInflow = vndDeposits._sum.amount || 0;

    // Baseline Seed Reserve (Initial liquidity pool in domestic bank: 500,000,000 VND)
    const INITIAL_VND_RESERVE = 500_000_000;
    const netVndReserve = Math.max(0, INITIAL_VND_RESERVE + totalVndInflow - totalVndOutflow);
    const netUsdReserve = totalUsdInflow;

    const ALERT_THRESHOLD_VND = 100_000_000; // 100 Million VND threshold
    const isLowLiquidity = netVndReserve < ALERT_THRESHOLD_VND;
    const isCritical = netVndReserve < 20_000_000;

    let liquidityStatus: 'HEALTHY' | 'WARNING_LOW_LIQUIDITY' | 'CRITICAL' = 'HEALTHY';
    let statusMessage = 'Quỹ thanh khoản VND đang dồi dào, sẵn sàng giải ngân tức thì.';

    if (isCritical) {
      liquidityStatus = 'CRITICAL';
      statusMessage = 'CẢNH BÁO KHẨN CẤP: Quỹ VND sắp cạn kiệt! Cần nạp thanh khoản vào tài khoản chi hộ PayOS ngay lập tức.';
    } else if (isLowLiquidity) {
      liquidityStatus = 'WARNING_LOW_LIQUIDITY';
      statusMessage = 'Cảnh báo: Quỹ thanh khoản VND đang dưới ngưỡng an toàn (100tr VND). Khuyến nghị Admin tái cân bằng USD sang VND.';
    }

    return {
      totalUsdInflow,
      totalVndOutflow,
      netVndReserve,
      netUsdReserve,
      liquidityStatus,
      liquidityAlertThresholdVnd: ALERT_THRESHOLD_VND,
      rebalanceRecommended: isLowLiquidity,
      statusMessage,
    };
  }

  /**
   * Internal / Admin method to grant promotional or system credit (Off-chain)
   */
  async grantSystemCredit(adminId: string, dto: GrantCreditDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Credit amount must be greater than 0');
    }

    const currency = (dto.currency || 'VND').toUpperCase();

    const wallet = await this.prisma.userWallet.upsert({
      where: { userId: dto.userId },
      update: {
        systemCredits: { increment: dto.amount },
        currency,
      },
      create: {
        userId: dto.userId,
        systemCredits: dto.amount,
        currency,
      },
    });

    await this.prisma.transaction.create({
      data: {
        userId: dto.userId,
        type: 'CREDIT_GRANT',
        amount: dto.amount,
        currency,
        status: 'COMPLETED',
        txHash: `credit_grant_${Date.now()}`,
      },
    });

    await this.auditLog.logAction(adminId, 'GRANT_SYSTEM_CREDIT', {
      targetUserId: dto.userId,
      amount: dto.amount,
      currency,
      reason: dto.reason || 'Admin credit grant',
    });

    return wallet;
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

  async handleWebhookProcessing(payload: any) {
    if (payload.userId && payload.amount) {
      const pendingTx = await this.prisma.transaction.findFirst({
        where: {
          userId: payload.userId,
          status: 'PENDING',
          amount: payload.amount,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingTx) {
        await this.prisma.transaction.update({
          where: { id: pendingTx.id },
          data: { status: 'COMPLETED', txHash: payload.txHash || pendingTx.txHash },
        });

        await this.auditLog.logAction(payload.userId, 'TRANSACTION_COMPLETED', {
          transactionId: pendingTx.id,
          type: pendingTx.type,
          amount: pendingTx.amount,
          currency: pendingTx.currency,
          txHash: payload.txHash,
        });
      }
    }
  }

  private async ensureUniqueNonce(nonce: string) {
    const existing = await this.prisma.transaction.findUnique({ where: { nonce } });
    if (existing) {
      throw new ConflictException('Transaction with this nonce has already been processed (Replay Attack Prevention)');
    }
  }

  /**
   * Custodial Web2 Currency Swap (Đổi ngoại tệ tức thì).
   * Backend tự động burn token nguồn và mint token đích trên blockchain (Web3 ở cánh gà).
   */
  async swap(userId: string, dto: SwapCurrencyDto) {
    const srcCurr = dto.sourceCurrency.toUpperCase().trim();
    const tgtCurr = dto.targetCurrency.toUpperCase().trim();

    if (srcCurr === tgtCurr) {
      throw new BadRequestException('Loại tiền nguồn và loại tiền đích không được trùng nhau');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Số lượng quy đổi phải lớn hơn 0');
    }

    const balanceInfo = await this.getBalance(userId);
    const availableSrcBalance = balanceInfo.breakdown?.[srcCurr]?.onChain ?? (balanceInfo.balances?.[srcCurr] ?? 0);

    if (availableSrcBalance < dto.amount) {
      throw new BadRequestException(`Số dư ${srcCurr} không đủ để quy đổi (Khả dụng: ${availableSrcBalance} ${srcCurr})`);
    }

    let exchangeRate = 1.0;
    let targetAmount = 0;
    let quoteId = dto.quoteId;

    if (dto.quoteId) {
      const validatedQuote = await this.exchangeRatesService.validateAndConsumeQuote(
        userId,
        dto.quoteId,
        srcCurr,
        tgtCurr,
        dto.amount,
      );
      targetAmount = validatedQuote.targetAmount;
      exchangeRate = validatedQuote.exchangeRate;
      quoteId = validatedQuote.id;
    } else {
      exchangeRate = await this.exchangeRatesService.getCrossRate(srcCurr, tgtCurr);
      targetAmount = Math.round((dto.amount * exchangeRate) * 100) / 100;
    }

    const nonce = dto.nonce || `swap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create swap record in ledger
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        type: 'SWAP',
        amount: dto.amount,
        currency: srcCurr,
        sourceCurrency: srcCurr,
        targetCurrency: tgtCurr,
        targetAmount,
        exchangeRate,
        quoteId,
        nonce,
        status: 'COMPLETED',
        txHash: `swap_${srcCurr}_to_${tgtCurr}_${Date.now()}`,
      },
    });

    // Web3 behind the scenes: Burn source token & Mint target token via fiat-bridge or direct smart contract call
    const bridgeUrl = this.configService.get<string>('FIAT_BRIDGE_URL') || 'http://localhost:8080';
    const bridgeApiKey = this.configService.get<string>('FIAT_BRIDGE_API_KEY') || '7afff93f725d94800318faeeb8c7662b6b57c6cb45f3ee3fcbf8df2d5150bb02';
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.walletAddress) {
      let bridgeSuccess = false;
      try {
        // 1. Send Burn request to fiat-bridge
        await axios.post(`${bridgeUrl}/api/v1/bridge/burn`, {
          core_tx_id: `swap_burn_${tx.id}`,
          user_address: user.walletAddress,
          amount: ethers.parseUnits(String(dto.amount), 18).toString(),
          currency: srcCurr,
        }, {
          headers: { 'X-API-Key': bridgeApiKey },
          timeout: 3000,
        });

        // 2. Send Mint request to fiat-bridge
        await axios.post(`${bridgeUrl}/api/v1/bridge/mint`, {
          core_tx_id: `swap_mint_${tx.id}`,
          user_address: user.walletAddress,
          amount: ethers.parseUnits(String(targetAmount), 18).toString(),
          currency: tgtCurr,
        }, {
          headers: { 'X-API-Key': bridgeApiKey },
          timeout: 3000,
        });
        bridgeSuccess = true;
        console.log(`✅ [Fiat-Bridge] Đã gửi lệnh Swap On-Chain: Burn ${dto.amount} ${srcCurr} -> Mint ${targetAmount} ${tgtCurr}`);
      } catch (bridgeErr: any) {
        console.warn(`⚠️ Fiat-bridge unavailable (${bridgeErr.message}), fallback sang tương tác Smart Contract trực tiếp...`);
      }

      // 3. Direct Smart Contract execution fallback (EVM Anvil/Hardhat/Node)
      if (!bridgeSuccess) {
        try {
          const rpcUrl = this.configService.get<string>('RPC_URL') || 'http://127.0.0.1:8545';
          const adminKey = this.configService.get<string>('ADMIN_PRIVATE_KEY') || 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const signer = new ethers.Wallet(adminKey, provider);
          const abi = [
            'function burn(string _coreTxId, address _from, uint256 _amount) external',
            'function mint(string _coreTxId, address _to, uint256 _amount) external',
            'function balanceOf(address owner) view returns (uint256)',
          ];

          const srcAddr = this.contractAddresses[srcCurr];
          const tgtAddr = this.contractAddresses[tgtCurr];

          if (srcAddr && tgtAddr) {
            const srcContract = new ethers.Contract(srcAddr, abi, signer);
            const tgtContract = new ethers.Contract(tgtAddr, abi, signer);

            // Check current on-chain balance of source token
            const srcBalWei = await srcContract.balanceOf(user.walletAddress);
            const reqBurnWei = ethers.parseUnits(String(dto.amount), 18);
            const burnWei = srcBalWei < reqBurnWei ? srcBalWei : reqBurnWei;

            if (burnWei > 0n) {
              const burnNonce = await provider.getTransactionCount(signer.address, 'latest');
              const burnTx = await srcContract.burn(`swap_burn_${tx.id}`, user.walletAddress, burnWei, { nonce: burnNonce });
              await burnTx.wait(1);
            }

            const mintNonce = await provider.getTransactionCount(signer.address, 'latest');
            const mintTx = await tgtContract.mint(`swap_mint_${tx.id}`, user.walletAddress, ethers.parseUnits(String(targetAmount), 18), { nonce: mintNonce });
            await mintTx.wait(1);

            console.log(`✅ [Direct-EVM] Đã đốt ${dto.amount} ${srcCurr} và mint ${targetAmount} ${tgtCurr} trực tiếp trên Smart Contract cho ví ${user.walletAddress}`);
          }
        } catch (onChainErr: any) {
          console.error(`⚠️ Lỗi tương tác Smart Contract trực tiếp:`, onChainErr.message);
        }
      }
    }

    await this.notificationsService.createNotification(
      userId,
      `🔄 Quy đổi ngoại tệ thành công: Đã đổi ${dto.amount} ${srcCurr} sang ${targetAmount} ${tgtCurr} (Tỷ giá: ${exchangeRate}).`,
      'SYSTEM',
      {
        transactionId: tx.id,
        sourceCurrency: srcCurr,
        sourceAmount: dto.amount,
        targetCurrency: tgtCurr,
        targetAmount,
        exchangeRate,
      }
    );

    return {
      transactionId: tx.id,
      sourceCurrency: srcCurr,
      sourceAmount: dto.amount,
      targetCurrency: tgtCurr,
      targetAmount,
      exchangeRate,
      status: 'COMPLETED',
    };
  }
}


