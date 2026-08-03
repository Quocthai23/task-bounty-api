const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');

const prisma = new PrismaClient();

async function sync() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const adminKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const signer = new ethers.Wallet(adminKey, provider);

  const abi = [
    'function mint(string _coreTxId, address _to, uint256 _amount) external',
    'function burn(string _coreTxId, address _from, uint256 _amount) external',
    'function balanceOf(address owner) view returns (uint256)',
  ];

  const contracts = {
    VND: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    USD: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    EUR: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
    JPY: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
    CNY: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707',
  };

  const users = await prisma.user.findMany({
    where: { walletAddress: { not: null } },
    include: { transactions: { where: { status: 'COMPLETED' } } }
  });

  for (const user of users) {
    console.log(`\nSyncing user ${user.email} (${user.walletAddress})...`);
    
    // Calculate ledger totals
    const ledgerTotals = { VND: 0, USD: 0, EUR: 0, JPY: 0, CNY: 0 };
    for (const tx of user.transactions) {
      const curr = (tx.currency || 'VND').toUpperCase();
      if (tx.type === 'DEPOSIT' || tx.type === 'PAYOUT') {
        ledgerTotals[curr] = (ledgerTotals[curr] || 0) + tx.amount;
      } else if (tx.type === 'WITHDRAW' || tx.type === 'LOCK') {
        ledgerTotals[curr] = (ledgerTotals[curr] || 0) - tx.amount;
      } else if (tx.type === 'SWAP') {
        const src = (tx.sourceCurrency || tx.currency).toUpperCase();
        const tgt = (tx.targetCurrency || 'USD').toUpperCase();
        ledgerTotals[src] = (ledgerTotals[src] || 0) - tx.amount;
        ledgerTotals[tgt] = (ledgerTotals[tgt] || 0) + (tx.targetAmount || 0);
      }
    }

    console.log('Target ledger balances:', ledgerTotals);

    for (const [curr, targetAmount] of Object.entries(ledgerTotals)) {
      if (!contracts[curr]) continue;
      const contract = new ethers.Contract(contracts[curr], abi, signer);
      const onChainWei = await contract.balanceOf(user.walletAddress);
      const onChain = parseFloat(ethers.formatUnits(onChainWei, 18));
      const diff = targetAmount - onChain;

      console.log(`[${curr}] On-Chain: ${onChain}, Target: ${targetAmount}, Diff: ${diff}`);

      if (Math.abs(diff) > 0.0001) {
        const nonce = await provider.getTransactionCount(signer.address, 'latest');
        if (diff > 0) {
          console.log(`Minting ${diff} ${curr} to ${user.walletAddress} (nonce: ${nonce})...`);
          const tx = await contract.mint(`sync_mint_${Date.now()}_${Math.random()}`, user.walletAddress, ethers.parseUnits(diff.toFixed(6), 18), { nonce });
          await tx.wait(1);
        } else {
          const burnAmount = Math.min(Math.abs(diff), onChain);
          if (burnAmount > 0) {
            console.log(`Burning ${burnAmount} ${curr} from ${user.walletAddress} (nonce: ${nonce})...`);
            const tx = await contract.burn(`sync_burn_${Date.now()}_${Math.random()}`, user.walletAddress, ethers.parseUnits(burnAmount.toFixed(6), 18), { nonce });
            await tx.wait(1);
          }
        }
      }
    }
  }

  console.log('\n--- Final On-Chain Verification ---');
  for (const user of users) {
    console.log(`User: ${user.email}`);
    for (const [curr, addr] of Object.entries(contracts)) {
      const contract = new ethers.Contract(addr, abi, provider);
      const bal = await contract.balanceOf(user.walletAddress);
      console.log(`  ${curr}: ${ethers.formatUnits(bal, 18)}`);
    }
  }
}

sync().catch(console.error).finally(() => prisma.$disconnect());
