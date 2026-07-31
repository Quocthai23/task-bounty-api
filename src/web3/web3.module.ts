import { Module } from '@nestjs/common';
import { Web3Controller } from './controllers/web3.controller';
import { Web3Service } from './services/web3.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [Web3Controller],
  providers: [Web3Service]
})
export class Web3Module {}
