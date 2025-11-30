import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRepository } from '../../repository/user/user.repository';

@Injectable()
export class HasPlanGuard implements CanActivate {
  constructor(private readonly userRepository: UserRepository) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    try {
      const user_id = req.user.userId;
      const userDetails = await this.userRepository.getUserDetails(user_id);

      // check if trial has expired
      // if (userDetails.tenant.trial_end_at < DateHelper.now()) {
      //   const tenantSubscriptionDetails =
      //     await this.userRepository.getSubscriptionDetails(user_id);

      //   if (tenantSubscriptionDetails) {
      //     return true;
      //   } else {
      //     throw new ForbiddenException('Access denied');
      //   }
      // } else {
      //   return true;
      // }
      return true;
    } catch (error) {
      throw new ForbiddenException(error.message);
    }
  }
}
