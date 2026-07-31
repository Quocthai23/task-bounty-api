import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'password123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cv.pdf' })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiPropertyOptional({ example: ['React', 'NestJS'] })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 'Male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 1995 })
  @IsOptional()
  birthYear?: number;

  @ApiPropertyOptional({ example: 'phone: 123456789' })
  @IsOptional()
  @IsString()
  contactInfo?: string;

  @ApiPropertyOptional({ example: { linkedin: 'https://...' } })
  @IsOptional()
  socialLinks?: any;
}

export class UserProfileDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: 'test@example.com' })
  email!: string;

  @ApiProperty({ example: '0x123abc...' })
  walletAddress!: string;
}

export class PublicProfileDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: '0x123abc...' })
  walletAddress!: string;
}
