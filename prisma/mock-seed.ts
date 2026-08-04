import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Create a mock PM user
  const pmUser = await prisma.user.upsert({
    where: { email: 'pm@taskbounty.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'pm@taskbounty.com',
      firstName: 'Project',
      lastName: 'Manager',
      username: 'projectmanager',
      password: hashedPassword,
      walletAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    },
  });

  await prisma.profile.upsert({
    where: { userId: pmUser.id },
    update: {},
    create: {
      userId: pmUser.id,
      title: 'Senior Project Manager',
      bio: 'Leading high-impact blockchain and web development projects.',
    }
  });

  await prisma.userWallet.upsert({
    where: { userId: pmUser.id },
    update: {
      systemCredits: 500000000,
      currency: 'VND',
    },
    create: {
      userId: pmUser.id,
      systemCredits: 500000000,
      currency: 'VND',
    }
  });

  // 2. Create a mock Dev user
  const devUser = await prisma.user.upsert({
    where: { email: 'dev@taskbounty.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'dev@taskbounty.com',
      firstName: 'Alex',
      lastName: 'Dev',
      username: 'alexdev',
      password: hashedPassword,
      walletAddress: '0xdD870fA1b7C4700F2BD7f44238821C26f7392148',
    },
  });

  await prisma.profile.upsert({
    where: { userId: devUser.id },
    update: {},
    create: {
      userId: devUser.id,
      title: 'Full Stack Blockchain Engineer',
      skills: JSON.stringify(['Reactjs', 'Nextjs', 'Nodejs', 'Solidity', 'TypeScript']),
      expectedRate: 35,
    }
  });

  await prisma.userWallet.upsert({
    where: { userId: devUser.id },
    update: {
      systemCredits: 100000000,
      currency: 'VND',
    },
    create: {
      userId: devUser.id,
      systemCredits: 100000000,
      currency: 'VND',
    }
  });

  console.log('✅ Created PM (pm@taskbounty.com) and Dev (dev@taskbounty.com) users. Password: password123');

  // 3. Clean existing tasks, applications, project members & projects
  await prisma.comment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.project.deleteMany({});
  console.log('Cleared existing projects, tasks & members');

  // 4. Create mock projects and tasks
  const projects = [
    {
      title: 'FrontEnd (Reactjs, Nextjs)',
      description: 'Write code reactjs, nextjs for development Management task.\n\n### Requirements\n- Experience with state management\n- Responsive design skills\n- Good understanding of hooks\n\n**Note**: Must be able to join daily scrums.',
      budget: 12000000,
      currency: 'VND',
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'FPT Software',
      priority: 'Moderate',
      positions: 2,
      skillsRequired: JSON.stringify(['Reactjs', 'Nextjs']),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isEscrowed: true,
      escrowTxHash: '0x123abc456def7890123abc456def7890123abc456def7890',
      ownerId: pmUser.id,
    },
    {
      title: 'Backend API Nodejs',
      description: 'Build robust REST APIs using Nodejs and NestJS. Experience with PostgreSQL and Prisma required.\n\n### Responsibilities\n- Design database schema\n- Implement JWT auth\n- Write unit tests',
      budget: 20000000,
      currency: 'VND',
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'VNG Corporation',
      priority: 'High',
      positions: 1,
      skillsRequired: JSON.stringify(['Nodejs', 'Database']),
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      isEscrowed: true,
      escrowTxHash: '0x987fed654cba3210987fed654cba3210987fed654cba3210',
      ownerId: pmUser.id,
    },
    {
      title: 'UI/UX Designer for Web App',
      description: 'Design complete user interfaces for a new internal management tool. Must be proficient in Figma.\n\n* Provide wireframes\n* Provide high-fidelity mockups\n* Export assets',
      budget: 8000000,
      currency: 'VND',
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'Tiki',
      priority: 'Low',
      positions: 1,
      skillsRequired: JSON.stringify(['Design']),
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      isEscrowed: false,
      escrowTxHash: null,
      ownerId: pmUser.id,
    },
    {
      title: 'Smart Contract Developer',
      description: 'Develop and audit Solidity smart contracts for an upcoming DeFi platform on Ethereum.\n\n**Key features**\n1. Staking\n2. Yield Farming\n3. Token presale\n\nMust have prior audit experience.',
      budget: 50000000,
      currency: 'VND',
      type: 'PUBLIC',
      status: 'OPEN',
      companyName: 'Kyber Network',
      priority: 'High',
      positions: 3,
      skillsRequired: JSON.stringify(['Web3', 'Solidity']),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isEscrowed: true,
      escrowTxHash: '0xabc123def456abc123def456abc123def456abc123def456',
      ownerId: pmUser.id,
    }
  ];

  for (const p of projects) {
    const createdProject = await prisma.project.create({ data: p });
    console.log('Created project:', createdProject.title);

    // Add PM as PM member and Dev as DEV member
    await prisma.projectMember.create({
      data: {
        projectId: createdProject.id,
        userId: pmUser.id,
        role: 'PM',
        permissions: 'CAN_VIEW_TASK,CAN_CREATE_TASK,CAN_MOVE_DONE,CAN_REVIEW_TASK'
      }
    });

    await prisma.projectMember.create({
      data: {
        projectId: createdProject.id,
        userId: devUser.id,
        role: 'DEV',
        permissions: 'CAN_VIEW_TASK'
      }
    });

    // Create sample tasks for project
    await prisma.task.create({
      data: {
        projectId: createdProject.id,
        title: `Phân tích yêu cầu và thiết kế kiến trúc - ${createdProject.title}`,
        description: 'Tài liệu SRS, thiết kế luồng hệ thống và database schema.',
        budget: Math.round(createdProject.budget * 0.2),
        priority: 'High',
        status: 'DONE',
        assigneeId: devUser.id,
        tags: JSON.stringify(['Architecture', 'Doc']),
      }
    });

    await prisma.task.create({
      data: {
        projectId: createdProject.id,
        title: `Triển khai tính năng cốt lõi cho ${createdProject.title}`,
        description: 'Code module chính, tích hợp API và hoàn thiện các view.',
        budget: Math.round(createdProject.budget * 0.5),
        priority: 'Urgent',
        status: 'IN_PROGRESS',
        assigneeId: devUser.id,
        tags: JSON.stringify(['Feature', 'Core']),
      }
    });

    await prisma.task.create({
      data: {
        projectId: createdProject.id,
        title: `Kiểm thử và tối ưu hiệu năng - ${createdProject.title}`,
        description: 'Viết unit tests, load test và bảo mật hệ thống.',
        budget: Math.round(createdProject.budget * 0.3),
        priority: 'Moderate',
        status: 'OPEN',
        tags: JSON.stringify(['Testing', 'QA']),
      }
    });
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
