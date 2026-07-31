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
}

export class BankAccountResponseDto {
  @ApiProperty({ example: '**** 6789' })
  maskedData!: string;
}

export class BalanceResponseDto {
  @ApiProperty({ example: 1050.5 })
  balance!: number;
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
