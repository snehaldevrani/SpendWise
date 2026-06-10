import { Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CustomCategoriesModule } from '../custom-categories/custom-categories.module';

@Module({
  imports: [PrismaModule, CustomCategoriesModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
