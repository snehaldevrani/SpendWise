/**
 * Worker entry point — runs only the BullMQ import-queue processors.
 * Start this as a separate process/container so heavy upload processing
 * does not starve the HTTP server.
 *
 * Usage: node dist/worker
 */
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { JobsModule } from './jobs/jobs.module';
import { validate } from './common/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    CacheModule,
    JobsModule,
  ],
})
class WorkerAppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['log', 'warn', 'error'],
  });

  // Keep the process alive while BullMQ workers are running
  app.enableShutdownHooks();

  console.log('SpendWise worker started — processing import-queue jobs');
}

bootstrap();
