import { ForbiddenError } from '@casl/ability';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRepository } from '../common/repository/user/user.repository';
import { CHECK_ABILITY, RequiredRule } from './abilities.decorator';
import { AbilityFactory } from './ability.factory';

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFacory: AbilityFactory,
    private userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rules =
      this.reflector.get<RequiredRule[]>(CHECK_ABILITY, context.getHandler()) ||
      [];

    const req = context.switchToHttp().getRequest();
    const userDetails = await this.userRepository.getUserDetails(req.user.userId);

    const ability = this.abilityFacory.defineAbility(userDetails);

    try {
      for (const rule of rules) {
        ForbiddenError.from(ability).throwUnlessCan(rule.action, rule.subject);
      }
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new ForbiddenException(error.message);
      }
    }
  }
}
