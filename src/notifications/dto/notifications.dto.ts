import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: 'uuid-user-1234' })
  userId!: string;

  @ApiProperty({ example: 'Your task has been approved.' })
  message!: string;

  @ApiProperty({ example: true })
  isRead!: boolean;

  @ApiProperty({ example: '2026-07-30T10:00:00Z' })
  createdAt!: string;
}

import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class PaginatedNotificationResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  data!: NotificationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
