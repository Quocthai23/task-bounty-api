import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsNumber } from 'class-validator';

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
  budget!: number;

  @ApiProperty({ example: 'PUBLIC', enum: ['PUBLIC', 'PRIVATE'] })
  @IsString()
  @IsIn(['PUBLIC', 'PRIVATE'])
  type!: string;
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
