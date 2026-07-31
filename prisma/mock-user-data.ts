import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'nguyenquocthaithtb@gmail.com';
  let user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    // If user doesn't exist, create it (although user should already exist)
    user = await prisma.user.create({
      data: {
        email,
        firstName: 'Thai',
        lastName: 'Nguyen',
        username: 'nguyenquocthai',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      }
    });
    console.log('Created user:', email);
  } else {
    console.log('Found user:', email);
  }

  // Ensure user has a profile
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    await prisma.profile.create({ data: { userId: user.id, title: 'Software Developer' } });
  }

  // 1. Mock 2 Jobs (Projects)
  await prisma.projectMember.deleteMany({ where: { userId: user.id } });
  await prisma.project.deleteMany({ where: { ownerId: user.id } });
  
  const existingProjects = await prisma.project.findMany({ where: { ownerId: user.id } });
  if (existingProjects.length < 2) {
    const p1 = await prisma.project.create({
      data: {
        title: 'Build a Decentralized Exchange (DEX)',
        description: 'Need a senior blockchain developer to build a DEX on Ethereum using Solidity and React.',
        budget: 5000,
        type: 'PUBLIC',
        status: 'OPEN',
        priority: 'High',
        positions: 2,
        skillsRequired: JSON.stringify(['Solidity', 'React', 'TypeScript', 'Web3.js']),
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: 'DEV' }
        }
      }
    });
    
    const p2 = await prisma.project.create({
      data: {
        title: 'Design UI/UX for Web3 Platform',
        description: 'Looking for a talented UI/UX designer to create high-fidelity wireframes and prototypes for our new Web3 gig platform.',
        budget: 1500,
        type: 'PUBLIC',
        status: 'OPEN',
        priority: 'Moderate',
        positions: 1,
        skillsRequired: JSON.stringify(['Figma', 'UI/UX', 'Web Design']),
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: 'DEV' }
        }
      }
    });
    console.log('Created 2 Mock Jobs for user');
  }

  // 2. Mock 15 Activity Logs distributed across different days
  // Delete existing logs for this user to avoid duplicate stacking during test
  await prisma.activityLog.deleteMany({ where: { userId: user.id } });
  
  const actions = [
    { action: "Created project 'Decentralized Exchange'", offset: -1 },
    { action: "Updated profile information", offset: -1 },
    { action: "Joined project 'AI Data Labeling'", offset: -2 },
    { action: "Submitted Task #45: 'Implement Authentication'", offset: -2 },
    { action: "Task #45 approved by Reviewer", offset: -3 },
    { action: "Received payout of $500 for Task #45", offset: -3 },
    { action: "Uploaded new CV 'Thai_CV_2026.pdf'", offset: -5 },
    { action: "Updated Tech Skills", offset: -5 },
    { action: "Created project 'Design UI/UX for Web3 Platform'", offset: -8 },
    { action: "Changed expected rate to $25/hr", offset: -8 },
    { action: "Connected Wallet '0x123...5678'", offset: -10 },
    { action: "Joined platform Task Bounty", offset: -10 },
  ];

  for (const log of actions) {
    const d = new Date();
    d.setDate(d.getDate() + log.offset);
    
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: log.action,
        createdAt: d
      }
    });
  }
  console.log('Created mock activity logs');

  // 3. Mock Transactions for Wallet UI (Vietinbank style)
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  const txs = [
    { type: 'DEPOSIT', amount: 15000000, status: 'COMPLETED', offset: -1 },
    { type: 'LOCK', amount: 5000000, status: 'COMPLETED', offset: -2 },
    { type: 'PAYOUT', amount: 20000000, status: 'COMPLETED', offset: -4 },
    { type: 'WITHDRAW', amount: 10000000, status: 'COMPLETED', offset: -5 },
    { type: 'DEPOSIT', amount: 5000000, status: 'COMPLETED', offset: -7 },
  ];
  for (const tx of txs) {
    const d = new Date();
    d.setDate(d.getDate() + tx.offset);
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        currency: 'VND',
        createdAt: d
      }
    });
  }
  console.log('Created mock transactions');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
