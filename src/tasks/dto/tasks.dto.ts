import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Implement the login flow using NestJS.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  budget?: number;

  @ApiPropertyOptional({ example: 'OPEN', enum: ['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE'] })
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE'])
  status?: string;

  @ApiPropertyOptional({ example: 'Moderate' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: '["Frontend", "Bug"]' })
  @IsOptional()
  tags?: string | string[];

  @ApiPropertyOptional({ example: '[{"id":"1","name":"design.png","base64":"data:image/png;base64,..."}]' })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  deadline?: string;

  @ApiPropertyOptional({ example: 'parent-task-uuid' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-assignee' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: [{ title: 'Thiết kế giao diện con', description: 'Chi tiết mô tả...' }] })
  @IsOptional()
  subtasks?: any[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  autoLockEscrow?: boolean;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Fix Navbar' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'IN_PROGRESS', enum: ['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE'] })
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE'])
  status?: string;

  @ApiPropertyOptional({ example: 'uuid-of-assignee' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  budget?: number;

  @ApiPropertyOptional({ example: 'Moderate' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: '["Frontend", "Bug"]' })
  @IsOptional()
  tags?: string | string[];

  @ApiPropertyOptional({ example: '[{"id":"1","name":"design.png","base64":"data:image/png;base64,..."}]' })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  deadline?: string;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Looking good!' })
  @IsString()
  content!: string;
}

export class TaskResponseDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: 'uuid-project-1234' })
  projectId!: string;

  @ApiProperty({ example: 'Implement login' })
  title!: string;

  @ApiProperty({ example: 'Implement the login flow using NestJS.' })
  description!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty({ example: 500 })
  budget!: number;
}

export class CommentResponseDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: 'Looking good!' })
  content!: string;

  @ApiProperty({ example: 'uuid-user-1234' })
  userId!: string;
}

import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class PaginatedTaskResponseDto {
  @ApiProperty({ type: [TaskResponseDto] })
  data!: TaskResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
