import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsNumber, IsOptional, IsArray, IsBoolean, IsEmail, Min } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'DeFi Dashboard' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'A dashboard to track DeFi metrics.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  budget!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'PUBLIC', enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxMembers?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @IsOptional()
  positions?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isRecruiting?: boolean;

  @ApiPropertyOptional({ example: '["React", "Solidity", "Node.js"]' })
  @IsString()
  @IsOptional()
  skillsRequired?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ example: ['dev1@gmail.com', 'dev2@gmail.com'] })
  @IsArray()
  @IsOptional()
  initialMemberEmails?: string[];
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'DeFi Dashboard' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'A dashboard to track DeFi metrics.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'PUBLIC', enum: ['PUBLIC', 'PRIVATE'] })
  @IsString()
  @IsIn(['PUBLIC', 'PRIVATE'])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxMembers?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isRecruiting?: boolean;

  @ApiPropertyOptional({ example: '["React", "TypeScript"]' })
  @IsString()
  @IsOptional()
  skillsRequired?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  deadline?: string;
}

export class AddMemberByEmailDto {
  @ApiProperty({ example: 'colleague@taskbounty.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'DEV', enum: ['PM', 'LEAD_DEV', 'REVIEWER', 'DEV'] })
  @IsString()
  @IsIn(['PM', 'LEAD_DEV', 'REVIEWER', 'DEV'])
  role!: string;

  @ApiPropertyOptional({ example: 'CAN_CREATE_TASK,CAN_MOVE_DONE' })
  @IsString()
  @IsOptional()
  permissions?: string;
}

export class UpdateMemberPermissionsDto {
  @ApiProperty({ example: 'CAN_CREATE_TASK,CAN_MOVE_DONE,CAN_REVIEW_TASK' })
  @IsString()
  @IsNotEmpty()
  permissions!: string;

  @ApiPropertyOptional({ example: 'LEAD_DEV', enum: ['PM', 'LEAD_DEV', 'REVIEWER', 'DEV'] })
  @IsString()
  @IsIn(['PM', 'LEAD_DEV', 'REVIEWER', 'DEV'])
  @IsOptional()
  role?: string;
}

export class RewardMemberDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'Khen thưởng hoàn thành xuất sắc Sprint 1 đúng hạn!' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApplyProjectDto {
  @ApiPropertyOptional({ example: 'Tôi có 3 năm kinh nghiệm xây dựng DApp...' })
  @IsString()
  @IsOptional()
  coverLetter?: string;
}

export class AssignRoleDto {
  @ApiProperty({ example: 'uuid-user-1234' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'LEAD_DEV', enum: ['PM', 'LEAD_DEV', 'REVIEWER', 'DEV'] })
  @IsString()
  @IsIn(['PM', 'LEAD_DEV', 'REVIEWER', 'DEV'])
  role!: string;
}

export class ProjectResponseDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: 'uuid-pm-1234' })
  pmId!: string;

  @ApiProperty({ example: 'DeFi Dashboard' })
  title!: string;

  @ApiProperty({ example: 'A dashboard to track DeFi metrics.' })
  description!: string;

  @ApiProperty({ example: 1000 })
  budget!: number;

  @ApiProperty({ example: 'PUBLIC' })
  type!: string;

  @ApiProperty({ example: '2026-07-30T10:00:00Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-30T10:00:00Z' })
  updatedAt!: string;
}

export class ProjectMemberResponseDto {
  @ApiProperty({ example: 'uuid-member-1234' })
  id!: string;

  @ApiProperty({ example: 'uuid-project-1234' })
  projectId!: string;

  @ApiProperty({ example: 'uuid-user-1234' })
  userId!: string;

  @ApiProperty({ example: 'LEAD_DEV' })
  role!: string;
}

import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class PaginatedProjectResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  data!: ProjectResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
