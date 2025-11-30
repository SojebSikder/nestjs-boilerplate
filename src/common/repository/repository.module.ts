import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserRepository } from './user/user.repository';
import { ChatRepository } from './chat/chat.repository';
import { NotificationRepository } from './notification/notification.repository';
import { TransactionRepository } from './transaction/transaction.repository';
import { UcodeRepository } from './ucode/ucode.repository';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    UserRepository,
    ChatRepository,
    NotificationRepository,
    TransactionRepository,
    UcodeRepository,
  ],
  exports: [
    UserRepository,
    ChatRepository,
    NotificationRepository,
    TransactionRepository,
    UcodeRepository,
  ],
})
export class RepositoryModule {}
