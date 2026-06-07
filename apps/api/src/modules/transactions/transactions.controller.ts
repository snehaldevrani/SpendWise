import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedPage = page ? Math.max(1, parseInt(page, 10) || 1) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const sanitizedSearch = search ? search.slice(0, 100) : undefined;

    return this.transactionsService.findAll(user.id, {
      page: parsedPage,
      limit: parsedLimit,
      category,
      search: sanitizedSearch,
      startDate,
      endDate,
    });
  }

  @Get('overview')
  getOverview(@CurrentUser() user: AuthUser) {
    return this.transactionsService.getOverview(user.id);
  }

  @Get('daily-spend')
  getDailySpend(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    const safeDays = Math.min(Math.max(parseInt(days ?? '60', 10) || 60, 1), 365);
    return this.transactionsService.getDailySpend(user.id, safeDays);
  }

  @Get('summary/monthly')
  getMonthlySummary(
    @CurrentUser() user: AuthUser,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!m || m < 1 || m > 12 || !y || y < 2000 || y > 2100) {
      return { income: 0, expenses: 0, net: 0, transactions: [] };
    }
    return this.transactionsService.getMonthlySummary(user.id, m, y);
  }

  @Delete('all')
  clearAll(@CurrentUser() user: AuthUser) {
    return this.transactionsService.clearAllData(user.id);
  }

  @Get('category-trends')
  getCategoryTrends(
    @CurrentUser() user: AuthUser,
    @Query('months') months?: string,
  ) {
    const safeMonths = Math.min(Math.max(parseInt(months ?? '6', 10) || 6, 1), 24);
    return this.transactionsService.getCategoryTrends(user.id, safeMonths);
  }

  /**
   * Aggregate money-in / money-out across an arbitrary date window.
   * Query params: start=YYYY-MM-DD  end=YYYY-MM-DD
   */
  @Get('range-overview')
  getRangeOverview(
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end)) {
      return { income: 0, expenses: 0, transactions: [] };
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return { income: 0, expenses: 0, transactions: [] };
    }
    // Cap range to 2 years to prevent full-table scan
    const MAX_RANGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > MAX_RANGE_MS) {
      return { income: 0, expenses: 0, transactions: [] };
    }
    endDate.setHours(23, 59, 59, 999);
    return this.transactionsService.getRangeOverview(user.id, startDate, endDate);
  }

  @Get('merchants')
  getMerchants(@CurrentUser() user: AuthUser) {
    return this.transactionsService.getDistinctMerchants(user.id);
  }

  @Patch(':id/category')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.transactionsService.updateCategory(user.id, id, dto.category);
  }
}
