import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class LockFundDto {
  @ApiProperty({ example: 'task-uuid-123' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;
}

export class ApprovePayoutDto {
  @ApiProperty({ example: 'task-uuid-123' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;
}

export class SyncTransactionDto {
  @ApiProperty({ example: '0x123abc456def789...' })
  @IsString()
  @IsNotEmpty()
  txHash!: string;

  @ApiProperty({ example: 'COMPLETED', enum: ['COMPLETED', 'FAILED'] })
  @IsString()
  @IsIn(['COMPLETED', 'FAILED'])
  status!: string;
}

export class Web3ResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: '0xlock_123456789' })
  txHash!: string;

  @ApiProperty({ example: 'Funds locked in Escrow' })
  message!: string;
}

export class SyncResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Transaction status updated to COMPLETED' })
  message!: string;
}
