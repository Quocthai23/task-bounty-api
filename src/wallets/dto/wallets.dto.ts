import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateBankAccountDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @ApiProperty({ example: 'Techcombank' })
  @IsString()
  @IsNotEmpty()
  bankName!: string;
}

export class DepositWithdrawDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({ example: 'nonce-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  nonce!: string;

  @ApiPropertyOptional({ example: 'bank-account-uuid' })
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional({ example: 'WALLET', enum: ['BANK', 'WALLET'] })
  @IsOptional()
  @IsString()
  method?: 'BANK' | 'WALLET';

  @ApiPropertyOptional({ example: '0x1234567890123456789012345678901234567890' })
  @IsOptional()
  @IsString()
  targetAddress?: string;

  @ApiPropertyOptional({ example: 'quote-uuid-1234', description: 'Mã báo giá khóa tỷ giá 15 phút cho giao dịch Cross-Currency' })
  @IsOptional()
  @IsString()
  quoteId?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Loại tiền nguồn bị trừ/burn' })
  @IsOptional()
  @IsString()
  sourceCurrency?: string;

  @ApiPropertyOptional({ example: 'VND', description: 'Loại tiền đích nhận về tài khoản ngân hàng' })
  @IsOptional()
  @IsString()
  targetCurrency?: string;
}

export class BankAccountResponseDto {
  @ApiProperty({ example: '**** 6789' })
  maskedData!: string;
}

export class BalanceBreakdownItemDto {
  @ApiProperty({ example: 500000 })
  onChain!: number;

  @ApiProperty({ example: 50000 })
  systemCredit!: number;

  @ApiProperty({ example: 0 })
  lockedEscrow!: number;

  @ApiProperty({ example: 550000 })
  total!: number;
}

export class BalanceResponseDto {
  @ApiProperty({ example: 550000, description: 'Total available balance (onChain + systemCredit)' })
  balance!: number;

  @ApiPropertyOptional({ example: 500000, description: 'Verified On-Chain token balance (Withdrawable)' })
  @IsOptional()
  onChainBalance?: number;

  @ApiPropertyOptional({ example: 50000, description: 'System bonus / Promo credit (Non-withdrawable)' })
  @IsOptional()
  systemCredit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Amount locked in escrow' })
  @IsOptional()
  lockedEscrow?: number;

  @ApiPropertyOptional({ example: { VND: 500000, USD: 100, EUR: 50, JPY: 10000, CNY: 200 } })
  @IsOptional()
  balances?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Detailed breakdown per currency' })
  @IsOptional()
  breakdown?: Record<string, BalanceBreakdownItemDto>;
}

export class GrantCreditDto {
  @ApiProperty({ example: 'uuid-user-1234' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Signup bonus promotional credit' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransactionResponseDto {
  @ApiProperty({ example: 'uuid-tx-1234' })
  id!: string;

  @ApiProperty({ example: 'uuid-user-1234' })
  userId!: string;

  @ApiProperty({ example: 'DEPOSIT' })
  type!: string;

  @ApiProperty({ example: 500 })
  amount!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty({ example: '0xhash...' })
  txHash!: string;
}

import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class PaginatedTransactionResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data!: TransactionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class CreateQuoteDto {
  @ApiProperty({ example: 'USD', description: 'Đồng tiền nguồn cần đổi/rút (vd: USD, EUR, JPY, CNY)' })
  @IsString()
  @IsNotEmpty()
  sourceCurrency!: string;

  @ApiProperty({ example: 'VND', description: 'Đồng tiền đích nhận về (vd: VND)' })
  @IsString()
  @IsNotEmpty()
  targetCurrency!: string;

  @ApiProperty({ example: 1000, description: 'Số lượng đồng tiền nguồn cần rút' })
  @IsNumber()
  amount!: number;
}

export class QuoteDetailsResponseDto {
  @ApiProperty({ example: 'quote-uuid-1234' })
  quoteId!: string;

  @ApiProperty({ example: 'USD' })
  sourceCurrency!: string;

  @ApiProperty({ example: 'VND' })
  targetCurrency!: string;

  @ApiProperty({ example: 1000 })
  sourceAmount!: number;

  @ApiProperty({ example: 25450000 })
  targetAmount!: number;

  @ApiProperty({ example: 25450 })
  exchangeRate!: number;

  @ApiProperty({ example: '2026-08-02T15:45:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: 900 })
  ttlSeconds!: number;
}

export class TreasuryStatusResponseDto {
  @ApiProperty({ example: 125000, description: 'Tổng USD nạp vào hệ thống (USD Inflow)' })
  totalUsdInflow!: number;

  @ApiProperty({ example: 1550000000, description: 'Tổng VND đã giải ngân cho Dev (VND Outflow)' })
  totalVndOutflow!: number;

  @ApiProperty({ example: 450000000, description: 'Số dư quỹ dự trữ VND còn lại trong ngân hàng giải ngân' })
  netVndReserve!: number;

  @ApiProperty({ example: 64000, description: 'Số dư quỹ USD tích lũy tại tài khoản quốc tế' })
  netUsdReserve!: number;

  @ApiProperty({ example: 'HEALTHY', enum: ['HEALTHY', 'WARNING_LOW_LIQUIDITY', 'CRITICAL'] })
  liquidityStatus!: 'HEALTHY' | 'WARNING_LOW_LIQUIDITY' | 'CRITICAL';

  @ApiProperty({ example: 100000000, description: 'Ngưỡng cảnh báo thanh khoản VND tối thiểu' })
  liquidityAlertThresholdVnd!: number;

  @ApiProperty({ example: false, description: 'Cảnh báo Admin cần thực hiện tái cân bằng quỹ ngoài đời' })
  rebalanceRecommended!: boolean;

}

export class SwapCurrencyDto {
  @ApiProperty({ example: 'USD', description: 'Loại tiền tệ nguồn cần đổi' })
  @IsString()
  @IsNotEmpty()
  sourceCurrency!: string;

  @ApiProperty({ example: 'VND', description: 'Loại tiền tệ đích nhận về' })
  @IsString()
  @IsNotEmpty()
  targetCurrency!: string;

  @ApiProperty({ example: 100, description: 'Số lượng tiền nguồn cần đổi' })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ example: 'quote-uuid-1234', description: 'Mã báo giá khóa tỷ giá 15 phút' })
  @IsOptional()
  @IsString()
  quoteId?: string;

  @ApiPropertyOptional({ example: 'nonce-uuid-1234' })
  @IsOptional()
  @IsString()
  nonce?: string;
}

export class SwapResponseDto {
  @ApiProperty({ example: 'tx-uuid-1234' })
  transactionId!: string;

  @ApiProperty({ example: 'USD' })
  sourceCurrency!: string;

  @ApiProperty({ example: 100 })
  sourceAmount!: number;

  @ApiProperty({ example: 'VND' })
  targetCurrency!: string;

  @ApiProperty({ example: 2545000 })
  targetAmount!: number;

  @ApiProperty({ example: 25450 })
  exchangeRate!: number;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;
}
