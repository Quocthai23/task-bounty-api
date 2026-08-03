import { Controller, Get, Post, Put, Body, UseGuards, Request, Query } from '@nestjs/common';
import { WalletsService } from '../services/wallets.service';
import { ExchangeRatesService } from '../services/exchange-rates.service';
import { 
  UpdateBankAccountDto, 
  DepositWithdrawDto, 
  BankAccountResponseDto, 
  BalanceResponseDto, 
  TransactionResponseDto, 
  PaginatedTransactionResponseDto, 
  GrantCreditDto,
  CreateQuoteDto,
  QuoteDetailsResponseDto,
  TreasuryStatusResponseDto,
  SwapCurrencyDto
} from '../dto/wallets.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Wallets')
@Controller('wallets')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  @ApiOperation({ summary: 'Get live exchange rates from European Central Bank (Frankfurter API)' })
  @ApiResponse({ status: 200, description: 'Live exchange rates dictionary.' })
  @Get('exchange-rates')
  getExchangeRates() {
    return this.exchangeRatesService.getLiveRates();
  }

  @ApiOperation({ summary: 'Create a 15-Minute Guaranteed Exchange Rate Quote for Cross-Currency Remittance' })
  @ApiResponse({ status: 201, description: 'Guaranteed exchange rate quote.', type: QuoteDetailsResponseDto })
  @Post('quote')
  createQuote(@Request() req: any, @Body() dto: CreateQuoteDto) {
    return this.exchangeRatesService.createQuote(req.user.sub, dto.sourceCurrency, dto.targetCurrency, dto.amount);
  }

  @ApiOperation({ summary: 'Get Treasury liquidity balance and reserves status' })
  @ApiResponse({ status: 200, description: 'Treasury status and liquidity health alert.', type: TreasuryStatusResponseDto })
  @Get('treasury')
  getTreasuryStatus() {
    return this.walletsService.getTreasuryStatus();
  }

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

  @ApiOperation({ summary: 'Deposit Fiat via PayOS' })
  @ApiResponse({ status: 201, description: 'Deposit transaction.', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('deposit')
  deposit(@Request() req: any, @Body() dto: DepositWithdrawDto) {
    return this.walletsService.deposit(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Withdraw Fiat or Crypto to bank/wallet (Supports Cross-Currency Remittance)' })
  @ApiResponse({ status: 201, description: 'Withdraw transaction.', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @ApiOperation({ summary: 'Grant promotional or system credit (Admin / Internal)' })
  @ApiResponse({ status: 200, description: 'Credit granted successfully.' })
  @Post('grant-credit')
  grantCredit(@Request() req: any, @Body() dto: GrantCreditDto) {
    return this.walletsService.grantSystemCredit(req.user.sub, dto);
  }

  @ApiOperation({ summary: 'Swap / Quy đổi ngoại tệ tức thì giữa các số dư (Web2 Custodial)' })
  @ApiResponse({ status: 201, description: 'Currency swapped successfully.' })
  @Post('swap')
  swap(@Request() req: any, @Body() dto: SwapCurrencyDto) {
    return this.walletsService.swap(req.user.sub, dto);
  }
}

