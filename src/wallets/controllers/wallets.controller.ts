import { Controller, Get, Post, Put, Body, UseGuards, Request, Query } from '@nestjs/common';
import { WalletsService } from '../services/wallets.service';
import { UpdateBankAccountDto, DepositWithdrawDto, BankAccountResponseDto, BalanceResponseDto, TransactionResponseDto, PaginatedTransactionResponseDto } from '../dto/wallets.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ChallengeOtpGuard } from '../../auth/guards/challenge-otp.guard';
import { RequireChallenge } from '../../auth/decorators/require-challenge.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Wallets')
@Controller('wallets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @ApiOperation({ summary: 'Update bank account information' })
  @ApiResponse({ status: 200, description: 'Bank account updated.', type: BankAccountResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Put('bank-account')
  updateBankAccount(@Request() req: any, @Body() dto: UpdateBankAccountDto) {
    return this.walletsService.updateBankAccount(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Get masked bank account' })
  @ApiResponse({ status: 200, description: 'Bank account details.', type: BankAccountResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('bank-account')
  getBankAccount(@Request() req: any) {
    return this.walletsService.getBankAccount(req.user.sub);
  }

  @ApiOperation({ summary: 'Get current wallet balance' })
  @ApiResponse({ status: 200, description: 'Wallet balance.', type: BalanceResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('balance')
  getBalance(@Request() req: any) {
    return this.walletsService.getBalance(req.user.sub);
  }

  @ApiOperation({ summary: 'Deposit Fiat via Mock Stripe' })
  @ApiHeader({ name: 'x-challenge-token', required: true, description: 'Challenge Token obtained from /auth/verify-otp' })
  @ApiResponse({ status: 201, description: 'Deposit transaction.', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @RequireChallenge('DEPOSIT')
  @UseGuards(ChallengeOtpGuard)
  @Post('deposit')
  deposit(@Request() req: any, @Body() dto: DepositWithdrawDto) {
    return this.walletsService.deposit(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Withdraw Fiat via Mock Stripe' })
  @ApiHeader({ name: 'x-challenge-token', required: true, description: 'Challenge Token obtained from /auth/verify-otp' })
  @ApiResponse({ status: 201, description: 'Withdraw transaction.', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @RequireChallenge('WITHDRAW')
  @UseGuards(ChallengeOtpGuard)
  @Post('withdraw')
  withdraw(@Request() req: any, @Body() dto: DepositWithdrawDto) {
    return this.walletsService.withdraw(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Get transaction history' })
  @ApiResponse({ status: 200, description: 'Transaction history.', type: PaginatedTransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('transactions')
  getTransactions(@Request() req: any, @Query() query: PaginationQueryDto) {
    return this.walletsService.getTransactions(req.user.sub, query.page || 1, query.limit || 10);
  }
}
