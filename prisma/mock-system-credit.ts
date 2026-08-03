import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Setting System Credit to 1,000,000,000 VND (1 Billion) for Users ---');

  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users in database.`);

  for (const user of users) {
    const updatedWallet = await prisma.userWallet.upsert({
      where: { userId: user.id },
      update: {
        systemCredits: 1000000000, // 1 Billion VND
        currency: 'VND',
      },
      create: {
        userId: user.id,
        systemCredits: 1000000000,
        currency: 'VND',
      },
    });

    console.log(`✅ Set systemCredits = 1,000,000,000 VND for user ${user.email} (ID: ${user.id})`);

    // Ensure user has a linked bank account for withdrawal
    const existingBank = await prisma.bankAccount.findUnique({ where: { userId: user.id } });
    if (!existingBank) {
      await prisma.bankAccount.create({
        data: {
          userId: user.id,
          encryptedData: '{"bankName":"MB Bank","accountNumber":"0987654321"}',
          maskedData: 'MB Bank - **** 4321',
        },
      });
      console.log(`🏦 Created default linked bank account for ${user.email}`);
    }
  }

  console.log('--- Mock system credit successfully updated to 1 Billion VND! ---');
}

main()
  .catch((e) => {
    console.error('Error running mock system credit:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
