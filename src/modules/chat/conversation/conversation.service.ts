import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import appConfig from '../../../config/app.config';
import { SojebStorage } from '../../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { MessageGateway } from '../message/message.gateway';

@Injectable()
export class ConversationService {
  constructor(
    private prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async create(createConversationDto: CreateConversationDto) {
    try {
      const data: any = {};

      if (createConversationDto.creator_id) {
        data.creator_id = createConversationDto.creator_id;
      }
      if (createConversationDto.participant_id) {
        data.participant_id = createConversationDto.participant_id;
      }

      // check if conversation exists
      let conversation = await this.prisma.conversation.findFirst({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        where: {
          creator_id: data.creator_id,
          participant_id: data.participant_id,
        },
      });

      if (conversation) {
        return {
          success: false,
          message: 'Conversation already exists',
          data: conversation,
        };
      }

      conversation = await this.prisma.conversation.create({
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
        data: {
          ...data,
        },
      });

      // add image url
      if (conversation.creator.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }
      if (conversation.participant.avatar) {
        conversation.participant['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.participant.avatar,
        );
      }

      // trigger socket event
      this.messageGateway.server.to(data.creator_id).emit('conversation', {
        from: data.creator_id,
        data: conversation,
      });
      this.messageGateway.server.to(data.participant_id).emit('conversation', {
        from: data.participant_id,
        data: conversation,
      });

      return {
        success: true,
        message: 'Conversation created successfully',
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll() {
    try {
      const conversations = await this.prisma.conversation.findMany({
        orderBy: {
          updated_at: 'desc',
        },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          messages: {
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
            select: {
              id: true,
              message: true,
              created_at: true,
            },
          },
        },
      });

      // add image url
      for (const conversation of conversations) {
        if (conversation.creator.avatar) {
          conversation.creator['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.creator.avatar,
          );
        }
        if (conversation.participant.avatar) {
          conversation.participant['avatar_url'] = SojebStorage.url(
            appConfig().storageUrl.avatar + conversation.participant.avatar,
          );
        }
      }

      return {
        success: true,
        data: conversations,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          creator_id: true,
          participant_id: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          participant: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // add image url
      if (conversation.creator.avatar) {
        conversation.creator['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + conversation.creator.avatar,
        );
      }

      return {
        success: true,
        data: conversation,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateConversationDto: UpdateConversationDto) {
    try {
      const data = {};
      if (updateConversationDto.creator_id) {
        data['creator_id'] = updateConversationDto.creator_id;
      }
      if (updateConversationDto.participant_id) {
        data['participant_id'] = updateConversationDto.participant_id;
      }

      await this.prisma.conversation.update({
        where: { id },
        data: {
          ...data,
          updated_at: DateHelper.now(),
        },
      });

      return {
        success: true,
        message: 'Conversation updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.conversation.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
