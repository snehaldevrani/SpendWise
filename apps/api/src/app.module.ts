import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { InsightsModule } from './modules/insights/insights.module';
import { AiModule } from './modules/ai/ai.module';
import { RagModule } from './modules/rag/rag.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { JobsModule } from './jobs/jobs.module';
import { validate } from './common/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    CacheModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    UploadsModule,
    SubscriptionsModule,
    InsightsModule,
    AiModule,
    RagModule,
    AlertsModule,
    JobsModule,
  ],
})
export class AppModule {}
