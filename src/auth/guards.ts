import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '../users/user.entity';

// Guard xac thuc: bat buoc co JWT hop le
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Decorator @Roles(Role.Admin) giong [Authorize(Roles = "...")] trong ABP/ASP.NET
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Guard phan quyen theo vai tro
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return !!user && required.includes(user.role);
  }
}
