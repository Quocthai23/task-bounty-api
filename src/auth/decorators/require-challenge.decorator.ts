import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CHALLENGE_KEY = 'requireChallenge';
export const RequireChallenge = (context: string) => SetMetadata(REQUIRE_CHALLENGE_KEY, context);
