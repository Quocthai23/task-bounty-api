const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      wallet: true,
      transactions: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const abi = ['function balanceOf(address owner) view returns (uint256)'];
  const contracts = {
    VND: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    USD: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    EUR: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
    JPY: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
    CNY: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707',
  };

  for (const user of users) {
    console.log(`\n================ User: ${user.email} (${user.id}) ================`);
    console.log(`Wallet Address: ${user.walletAddress}`);
    console.log(`Wallet DB Record:`, user.wallet);

    console.log(`--- On-Chain Balances ---`);
    if (user.walletAddress) {
      for (const [curr, addr] of Object.entries(contracts)) {
        try {
          const contract = new ethers.Contract(addr, abi, provider);
          const bal = await contract.balanceOf(user.walletAddress);
          console.log(`  ${curr} on-chain: ${ethers.formatUnits(bal, 18)}`);
        } catch (e) {
          console.log(`  ${curr} on-chain error: ${e.message}`);
        }
      }
    }

    console.log(`--- Recent Transactions ---`);
    for (const tx of user.transactions) {
      console.log(`  [${tx.type}] ${tx.status} | Amount: ${tx.amount} ${tx.currency} | Src: ${tx.sourceCurrency} -> Tgt: ${tx.targetCurrency} (${tx.targetAmount}) | Hash: ${tx.txHash}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
