import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RagModule } from '../rag/rag.module';
import { CustomCategoriesModule } from '../custom-categories/custom-categories.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [RagModule, CustomCategoriesModule, BudgetsModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
