import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private budgetsService: BudgetsService) {}

  @Get()
  getBudgets(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    const y = year ? parseInt(year, 10) : now.getFullYear();
    return this.budgetsService.getBudgetSummary(user.id, m, y);
  }

  @Post()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertBudgetDto) {
    return this.budgetsService.upsertBudget(
      user.id,
      dto.category,
      dto.limitAmount,
      dto.month,
      dto.year,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.budgetsService.deleteBudget(user.id, id);
  }
}
