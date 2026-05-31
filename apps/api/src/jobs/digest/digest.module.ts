import { Module } from '@nestjs/common';
import { DigestService } from './digest.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AlertsModule } from '../../modules/alerts/alerts.module';

@Module({
  imports: [PrismaModule, AlertsModule],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
