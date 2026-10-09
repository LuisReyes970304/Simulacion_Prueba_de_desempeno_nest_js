import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { findUserByUsername } from '../users.js';

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const username = request.headers['x-user'];

    if (!username) {
      throw new UnauthorizedException('Missing x-user header');
    }

    const user = findUserByUsername(username);
    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }

    request.user = user;
    return true;
  }
}
