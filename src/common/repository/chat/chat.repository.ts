import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { MessageStatus } from 'prisma/generated/enums';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Update message status
   * @returns
   */
  async updateMessageStatus(message_id: string, status: MessageStatus) {
    // if message exist
    const message = await this.prisma.message.findFirst({
      where: {
        id: message_id,
      },
    });

    if (!message) {
      return;
    }

    await this.prisma.message.update({
      where: {
        id: message_id,
      },
      data: {
        status,
      },
    });
  }

  /**
   * Update user status
   * @returns
   */
  async updateUserStatus(user_id: string, status: string) {
    // if user exist
    const user = await this.prisma.user.findFirst({
      where: {
        id: user_id,
      },
    });

    if (!user) {
      return;
    }
    return await this.prisma.user.update({
      where: { id: user_id },
      data: {
        availability: status,
      },
    });
  }
}
