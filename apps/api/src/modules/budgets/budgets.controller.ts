import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { CustomCategoriesService } from '../custom-categories/custom-categories.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const PREDEFINED_CATEGORIES = [
  { slug: 'food', name: 'Food', emoji: '🍕', isCustom: false },
  { slug: 'travel', name: 'Travel', emoji: '✈️', isCustom: false },
  { slug: 'utilities', name: 'Utilities', emoji: '💡', isCustom: false },
  { slug: 'entertainment', name: 'Entertainment', emoji: '🎬', isCustom: false },
  { slug: 'health', name: 'Health', emoji: '🏥', isCustom: false },
  { slug: 'shopping', name: 'Shopping', emoji: '🛍️', isCustom: false },
  { slug: 'subscriptions', name: 'Subscriptions', emoji: '📦', isCustom: false },
  { slug: 'income', name: 'Income', emoji: '💰', isCustom: false },
  { slug: 'other', name: 'Other', emoji: '📌', isCustom: false },
];

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(
    private budgetsService: BudgetsService,
    private customCategories: CustomCategoriesService,
    private prisma: PrismaService,
  ) {}

  @Get('categories/available')
  async getAvailableCategories(@CurrentUser() user: AuthUser) {
    const customCats = await this.customCategories.list(user.id);
    const customCatObjects = customCats.map((c) => ({
      slug: c.slug,
      name: c.name,
      emoji: c.emoji || '📁',
      isCustom: true,
    }));
    return [...PREDEFINED_CATEGORIES, ...customCatObjects];
  }

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
    const recurring = dto.recurring ?? false;
    const now = new Date();
    const month = recurring ? 0 : (dto.month ?? now.getMonth() + 1);
    const year  = recurring ? 0 : (dto.year  ?? now.getFullYear());

    return this.budgetsService.upsertBudget(
      user.id,
      dto.category,
      dto.limitAmount,
      month,
      year,
      recurring,
    );
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.budgetsService.deleteBudget(user.id, id);
  }
}
