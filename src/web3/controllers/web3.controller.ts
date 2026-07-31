import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Web3Service } from '../services/web3.service';
import { LockFundDto, ApprovePayoutDto, SyncTransactionDto, Web3ResponseDto, SyncResponseDto } from '../dto/web3.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Web3 & Bounty')
@Controller('bounty')
export class Web3Controller {
  constructor(private readonly web3Service: Web3Service) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Lock funds in Smart Contract (Escrow)' })
  @ApiResponse({ status: 201, description: 'Funds locked successfully.', type: Web3ResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Post('lock-fund')
  lockFund(@Request() req: any, @Body() dto: LockFundDto) {
    return this.web3Service.lockFund(req.user.sub, dto.taskId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Approve payout from Smart Contract to Developer' })
  @ApiResponse({ status: 201, description: 'Payout approved successfully.', type: Web3ResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Post('approve-payout')
  approvePayout(@Request() req: any, @Body() dto: ApprovePayoutDto) {
    return this.web3Service.approvePayout(req.user.sub, dto.taskId);
  }

  @ApiOperation({ summary: 'Sync Blockchain Transaction Status (Webhook/Indexer)' })
  @ApiResponse({ status: 201, description: 'Transaction synced.', type: SyncResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Post('sync')
  syncTransaction(@Body() dto: SyncTransactionDto) {
    return this.web3Service.syncTransaction(dto);
  }
}
