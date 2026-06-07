import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CustomCategoriesController } from './custom-categories.controller';
import { CustomCategoriesService } from './custom-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomCategoriesController],
  providers: [CustomCategoriesService],
  exports: [CustomCategoriesService],
})
export class CustomCategoriesModule {}
