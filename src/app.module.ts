// external imports
import { MiddlewareConsumer, Module } from '@nestjs/common';
// import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { RedisModule } from '@nestjs-modules/ioredis';

// internal imports
import appConfig from './config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
// import { ThrottlerBehindProxyGuard } from './common/guard/throttler-behind-proxy.guard';
import { AbilityModule } from './ability/ability.module';
import { MailModule } from './mail/mail.module';
import { ApplicationModule } from './modules/application/application.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PrometheusModule } from './prometheus/prometheus.module';
import { RepositoryModule } from './common/repository/repository.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    BullModule.forRoot({
      connection: {
        host: appConfig().redis.host,
        password: appConfig().redis.password,
        port: +appConfig().redis.port,
      },
      // redis: {
      //   host: appConfig().redis.host,
      //   password: appConfig().redis.password,
      //   port: +appConfig().redis.port,
      // },
    }),
    RedisModule.forRoot({
      type: 'single',
      options: {
        host: appConfig().redis.host,
        password: appConfig().redis.password,
        port: +appConfig().redis.port,
      },
    }),
    // disabling throttling for dev
    // ThrottlerModule.forRoot([
    //   {
    //     name: 'short',
    //     ttl: 1000,
    //     limit: 3,
    //   },
    //   {
    //     name: 'medium',
    //     ttl: 10000,
    //     limit: 20,
    //   },
    //   {
    //     name: 'long',
    //     ttl: 60000,
    //     limit: 100,
    //   },
    // ]),
    // General modules
    PrismaModule,
    RepositoryModule,
    AuthModule,
    AbilityModule,
    MailModule,
    ApplicationModule,
    AdminModule,
    ChatModule,
    PaymentModule,
    PrometheusModule,
  ],
  controllers: [AppController],
  providers: [
    // disabling throttling for dev
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
    // disbling throttling for dev {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerBehindProxyGuard,
    // },
    AppService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
