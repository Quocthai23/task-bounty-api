import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { REQUIRE_CHALLENGE_KEY } from '../decorators/require-challenge.decorator';

@Injectable()
export class ChallengeOtpGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredContext = this.reflector.getAllAndOverride<string>(REQUIRE_CHALLENGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredContext) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // Challenge token can be passed in headers or body
    const token = request.headers['x-challenge-token'] || request.body?.challengeToken;
    
    if (!token) {
      throw new UnauthorizedException('Challenge token is required for this action');
    }

    try {
      const payload = this.jwtService.verify(token);
      
      if (payload.context !== requiredContext) {
        throw new ForbiddenException(`Invalid challenge context. Expected ${requiredContext}, got ${payload.context}`);
      }

      // If user is authenticated via AuthGuard, ensure the challenge token email matches the logged in user's email
      if (request.user && request.user.email !== payload.email) {
        throw new ForbiddenException('Challenge token does not belong to the authenticated user');
      }

      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
  }
}
