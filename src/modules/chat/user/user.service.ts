import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          status: 1,
          type: {
            not: 'user',
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          type: true,
        },
      });

      return {
        success: true,
        data: users,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
