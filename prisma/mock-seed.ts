import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create a mock PM user
  const pmUser = await prisma.user.upsert({
    where: { email: 'pm@taskbounty.com' },
    update: {},
    create: {
      email: 'pm@taskbounty.com',
      firstName: 'Project',
      lastName: 'Manager',
      password: 'password123', // In a real app this should be hashed, but for seed it's fine
    },
  });

  console.log('Created PM User:', pmUser.email);

  // Create mock projects
  const projects = [
    {
      title: 'FrontEnd(Reactjs, Nextjs)',
      description: 'Write code reactjs, nextjs for development Management task.\n\n### Requirements\n- Experience with state management\n- Responsive design skills\n- Good understanding of hooks\n\n**Note**: Must be able to join daily scrums.',
      budget: 12000000,
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'FPT Software',
      priority: 'Moderate',
      positions: 2,
      skillsRequired: JSON.stringify(['Reactjs', 'Nextjs']),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isEscrowed: true,
      escrowTxHash: '0x123abc456def7890123abc456def7890123abc456def7890',
      ownerId: pmUser.id,
    },
    {
      title: 'Backend API Nodejs',
      description: 'Build robust REST APIs using Nodejs and NestJS. Experience with PostgreSQL and Prisma required.\n\n### Responsibilities\n- Design database schema\n- Implement JWT auth\n- Write unit tests',
      budget: 20000000,
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'VNG Corporation',
      priority: 'High',
      positions: 1,
      skillsRequired: JSON.stringify(['Nodejs', 'Database']),
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      isEscrowed: true,
      escrowTxHash: '0x987fed654cba3210987fed654cba3210987fed654cba3210',
      ownerId: pmUser.id,
    },
    {
      title: 'UI/UX Designer for Web App',
      description: 'Design complete user interfaces for a new internal management tool. Must be proficient in Figma.\n\n* Provide wireframes\n* Provide high-fidelity mockups\n* Export assets',
      budget: 8000000,
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'Tiki',
      priority: 'Low',
      positions: 1,
      skillsRequired: JSON.stringify(['Design']),
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      isEscrowed: false,
      escrowTxHash: null,
      ownerId: pmUser.id,
    },
    {
      title: 'Smart Contract Developer',
      description: 'Develop and audit Solidity smart contracts for an upcoming DeFi platform on Ethereum.\n\n**Key features**\n1. Staking\n2. Yield Farming\n3. Token presale\n\nMust have prior audit experience.',
      budget: 50000000,
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'Kyber Network',
      priority: 'High',
      positions: 3,
      skillsRequired: JSON.stringify(['Web3', 'Solidity']),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isEscrowed: true,
      escrowTxHash: '0xabc123def456abc123def456abc123def456abc123def456',
      ownerId: pmUser.id,
    }
  ];

  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  console.log('Cleared existing projects');

  for (const p of projects) {
    await prisma.project.create({ data: p });
    console.log('Created project:', p.title);
  }

  console.log('Seed finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
