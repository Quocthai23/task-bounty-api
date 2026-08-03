import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implement login' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Implement the login flow using NestJS.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  budget?: number;

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
}

export class UpdateTaskDto {
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
