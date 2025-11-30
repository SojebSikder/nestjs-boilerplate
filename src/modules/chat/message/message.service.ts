import { Injectable } from '@nestjs/common';

import appConfig from '../../../config/app.config';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatRepository } from '../../../common/repository/chat/chat.repository';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from './message.gateway';
import { UserRepository } from '../../../common/repository/user/user.repository';
import { Role } from '../../../common/guard/role/role.enum';
import { MessageStatus } from 'prisma/generated/enums';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
    private userRepository: UserRepository,
    private chatRepository: ChatRepository,
  ) {}

  async create(user_id: string, createMessageDto: CreateMessageDto) {
    try {
      const data: any = {};

      if (createMessageDto.conversation_id) {
        data.conversation_id = createMessageDto.conversation_id;
      }

      if (createMessageDto.receiver_id) {
        data.receiver_id = createMessageDto.receiver_id;
      }

      if (createMessageDto.message) {
        data.message = createMessageDto.message;
      }

      // check if conversation exists
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: data.conversation_id,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      // check if receiver exists
      const receiver = await this.prisma.user.findFirst({
        where: {
          id: data.receiver_id,
        },
      });

      if (!receiver) {
        return {
          success: false,
          message: 'Receiver not found',
        };
      }

      const message = await this.prisma.message.create({
        data: {
          ...data,
          status: MessageStatus.SENT,
          sender_id: user_id,
        },
      });

      // update conversation updated_at
      await this.prisma.conversation.update({
        where: {
          id: data.conversation_id,
        },
        data: {
          updated_at: DateHelper.now(),
        },
      });

      // this.messageGateway.server
      //   .to(this.messageGateway.clients.get(data.receiver_id))
      //   .emit('message', { from: data.receiver_id, data: message });

      return {
        success: true,
        data: message,
        message: 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll({
    user_id,
    conversation_id,
    limit = 20,
    cursor,
  }: {
    user_id: string;
    conversation_id: string;
    limit?: number;
    cursor?: string;
  }) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const where_condition = {
        AND: [{ id: conversation_id }],
      };

      if (userDetails.type != Role.ADMIN) {
        where_condition['OR'] = [
          { creator_id: user_id },
          { participant_id: user_id },
        ];
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          ...where_condition,
        },
      });

      if (!conversation) {
        return {
          success: false,
          message: 'Conversation not found',
        };
      }

      const paginationData = {};
      if (limit) {
        paginationData['take'] = limit;
      }
      if (cursor) {
        paginationData['cursor'] = cursor ? { id: cursor } : undefined;
      }

      const messages = await this.prisma.message.findMany({
        ...paginationData,
        where: {
          conversation_id: conversation_id,
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          id: true,
          message: true,
          created_at: true,
          status: true,
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },

          attachment: {
            select: {
              id: true,
              name: true,
              type: true,
              size: true,
              file: true,
            },
          },
        },
      });

      // add attachment url
      for (const message of messages) {
        if (message.attachment) {
          message.attachment['file_url'] = SojebStorage.url(
            appConfig().storageUrl.attachment + message.attachment.file,
          );
        }
      }

      // add image url
      for (const message of messages) {
        if (message.sender && message.sender.avatar) {
          message.sender['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + message.sender.avatar,
          );
        }
        if (message.receiver && message.receiver.avatar) {
          message.receiver['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + message.receiver.avatar,
          );
        }
      }

      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateMessageStatus(message_id: string, status: MessageStatus) {
    return await this.chatRepository.updateMessageStatus(message_id, status);
  }

  async readMessage(message_id: string) {
    return await this.chatRepository.updateMessageStatus(
      message_id,
      MessageStatus.READ,
    );
  }

  async updateUserStatus(user_id: string, status: string) {
    return await this.chatRepository.updateUserStatus(user_id, status);
  }
}
