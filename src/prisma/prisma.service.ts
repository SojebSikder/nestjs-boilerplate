// external imports
import {
  Logger,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
// internal imports
import appConfig from '../config/app.config';
import { PrismaClient } from 'prisma/generated/client';

const connectionString = appConfig().database.url;
@Injectable()
export class PrismaService
extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });

    // comment out this when seeding data using command line
    if (process.env.PRISMA_ENV == '1') {
      console.log('Prisma Middleware not called', process.env.PRISMA_ENV);
    } else {
      // use middleware here
      // this.$use(SoftdeleteMiddleware);
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
