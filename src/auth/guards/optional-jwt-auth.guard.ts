import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * B-1 (2026-11-11): lets a route serve both anonymous and signed-in callers.
 *
 * - Valid bearer token  -> request.user is set (same payload as JwtAuthGuard).
 * - No token, or an invalid/expired token -> request.user is null and the
 *   request continues as ANONYMOUS. It never grants more than anonymous access,
 *   so an invalid token can only reduce what the caller sees.
 *
 * Routes using this guard must decide what to return from request.user
 * themselves. Never use it on a route that requires authentication.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
