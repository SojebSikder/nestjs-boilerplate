import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      const faqs = await this.prisma.faq.findMany({
        orderBy: {
          sort_order: 'asc',
        },
        select: {
          id: true,
          question: true,
          answer: true,
        },
      });
      return {
        success: true,
        data: faqs,
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
      const faq = await this.prisma.faq.findUnique({
        where: { id },
        select: {
          id: true,
          question: true,
          answer: true,
        },
      });
      return {
        success: true,
        data: faq,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
