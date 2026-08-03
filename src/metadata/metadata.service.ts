import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BASE_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Solidity', 'Web3.js', 'Next.js',
  'Python', 'Go', 'Rust', 'Docker', 'PostgreSQL', 'TailwindCSS',
  'GraphQL', 'AWS', 'Kubernetes', 'Smart Contract', 'UI/UX', 'Figma',
  'DeFi', 'Hardhat', 'Ethers.js', 'NestJS', 'MongoDB', 'Redis'
];

const BASE_POSITIONS = [
  'Front End', 'Back End', 'Full Stack', 'Smart Contract',
  'DeFi Engineer', 'UI/UX Design', 'DevOps', 'Mobile', 'QA / Tester', 'Project Manager'
];

@Injectable()
export class MetadataService {
  constructor(private readonly prisma: PrismaService) {}

  async getSkills(): Promise<string[]> {
    const skillSet = new Map<string, string>(); // lowercase -> display name

    // 1. Seed base skills
    BASE_SKILLS.forEach(s => skillSet.set(s.toLowerCase(), s));

    try {
      // 2. Extract from all projects in DB
      const projects = await this.prisma.project.findMany({
        select: { skillsRequired: true },
      });

      for (const p of projects) {
        if (!p.skillsRequired) continue;
        try {
          const parsed = typeof p.skillsRequired === 'string'
            ? JSON.parse(p.skillsRequired)
            : p.skillsRequired;

          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (typeof s === 'string' && s.trim()) {
                const trimmed = s.trim();
                skillSet.set(trimmed.toLowerCase(), trimmed);
              }
            });
          } else if (typeof parsed === 'string' && parsed.trim()) {
            parsed.split(',').forEach(s => {
              const trimmed = s.trim();
              if (trimmed) skillSet.set(trimmed.toLowerCase(), trimmed);
            });
          }
        } catch {
          // If plain comma string
          if (typeof p.skillsRequired === 'string') {
            p.skillsRequired.split(',').forEach(s => {
              const trimmed = s.trim();
              if (trimmed) skillSet.set(trimmed.toLowerCase(), trimmed);
            });
          }
        }
      }

      // 3. Extract from user profiles
      const profiles = await this.prisma.profile.findMany({
        select: { skills: true },
      });

      for (const pr of profiles) {
        if (!pr.skills) continue;
        try {
          const parsed = typeof pr.skills === 'string' ? JSON.parse(pr.skills) : pr.skills;
          if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => {
              if (typeof s === 'string' && s.trim()) {
                const trimmed = s.trim();
                skillSet.set(trimmed.toLowerCase(), trimmed);
              }
            });
          }
        } catch {
          // ignore parsing error
        }
      }
    } catch (err) {
      console.error('Error fetching dynamic skills from DB:', err);
    }

    return Array.from(skillSet.values());
  }

  async getPositions(): Promise<string[]> {
    const posSet = new Map<string, string>();
    BASE_POSITIONS.forEach(p => posSet.set(p.toLowerCase(), p));

    try {
      const projects = await this.prisma.project.findMany({
        select: { title: true, description: true },
      });

      // Match common keywords in titles to discover positions
      for (const p of projects) {
        const text = `${p.title} ${p.description || ''}`.toLowerCase();
        if (text.includes('smart contract') || text.includes('solidity')) {
          posSet.set('smart contract', 'Smart Contract');
        }
        if (text.includes('front end') || text.includes('frontend') || text.includes('react')) {
          posSet.set('front end', 'Front End');
        }
        if (text.includes('back end') || text.includes('backend') || text.includes('nest')) {
          posSet.set('back end', 'Back End');
        }
        if (text.includes('full stack') || text.includes('fullstack')) {
          posSet.set('full stack', 'Full Stack');
        }
        if (text.includes('defi') || text.includes('dex') || text.includes('liquidity')) {
          posSet.set('defi', 'DeFi Engineer');
        }
        if (text.includes('design') || text.includes('ui/ux') || text.includes('figma')) {
          posSet.set('ui/ux design', 'UI/UX Design');
        }
      }
    } catch (err) {
      console.error('Error fetching dynamic positions:', err);
    }

    return Array.from(posSet.values());
  }

  async getBudgetRanges() {
    try {
      const projects = await this.prisma.project.findMany({
        where: { type: 'PUBLIC' },
        select: { budget: true },
      });

      const budgets = projects.map(p => Number(p.budget) || 0).filter(b => b > 0);
      const minBudget = budgets.length > 0 ? Math.min(...budgets) : 0;
      const maxBudget = budgets.length > 0 ? Math.max(...budgets) : 100000000;

      return {
        min: minBudget,
        max: maxBudget,
        presets: [
          { label: 'Tất cả', min: '', max: '' },
          { label: '< 5 Tr', min: '0', max: '5000000' },
          { label: '5M - 20M', min: '5000000', max: '20000000' },
          { label: '20M - 50M', min: '20000000', max: '50000000' },
          { label: '> 50 Tr', min: '50000000', max: '' },
        ]
      };
    } catch (err) {
      return {
        min: 0,
        max: 100000000,
        presets: [
          { label: 'Tất cả', min: '', max: '' },
          { label: '< 5 Tr', min: '0', max: '5000000' },
          { label: '5M - 20M', min: '5000000', max: '20000000' },
          { label: '20M - 50M', min: '20000000', max: '50000000' },
          { label: '> 50 Tr', min: '50000000', max: '' },
        ]
      };
    }
  }
}
