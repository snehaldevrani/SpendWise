import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportProcessor } from './import.processor';
import { RagModule } from '../modules/rag/rag.module';
import { SubscriptionsModule } from '../modules/subscriptions/subscriptions.module';
import { InsightsModule } from '../modules/insights/insights.module';
import { IMPORT_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.get('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port || '6379', 10),
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: IMPORT_QUEUE }),
    RagModule,
    SubscriptionsModule,
    InsightsModule,
  ],
  providers: [ImportProcessor],
  exports: [BullModule],
})
export class JobsModule {}
