import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'test@example.com or johndoe' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'old_password123' })
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty({ example: 'new_password123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJh...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class UserDto {
  @ApiProperty({ example: 'uuid-1234' })
  id!: string;

  @ApiProperty({ example: 'test@example.com' })
  email!: string;

  @ApiProperty({ example: '0x123abc...' })
  walletAddress!: string;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJh...' })
  access_token!: string;

  @ApiProperty({ example: 'eyJh...' })
  refresh_token!: string;

  @ApiProperty({ type: () => UserDto })
  user!: UserDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message!: string;
}

export class SendOtpDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'REGISTER', description: 'Context of the OTP, e.g. REGISTER, WITHDRAW, DEPOSIT' })
  @IsString()
  @IsNotEmpty()
  context!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'REGISTER' })
  @IsString()
  @IsNotEmpty()
  context!: string;
}

export class ChallengeResponseDto {
  @ApiProperty({ example: 'eyJh...', description: 'A short-lived JWT token to prove OTP verification' })
  challengeToken!: string;
}
