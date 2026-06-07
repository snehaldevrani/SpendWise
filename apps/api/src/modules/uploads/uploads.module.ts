import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { CsvParserService } from './csv-parser.service';
import { IMPORT_QUEUE } from '../../jobs/queue.constants';
import { CustomCategoriesModule } from '../custom-categories/custom-categories.module';

@Module({
  imports: [BullModule.registerQueue({ name: IMPORT_QUEUE }), CustomCategoriesModule],
  providers: [UploadsService, CsvParserService],
  controllers: [UploadsController],
})
export class UploadsModule {}
