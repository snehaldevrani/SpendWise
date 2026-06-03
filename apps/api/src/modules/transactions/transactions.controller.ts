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
    return this.transactionsService.getDailySpend(user.id, days ? parseInt(days) : 60);
  }

  @Get('summary/monthly')
  getMonthlySummary(
    @CurrentUser() user: AuthUser,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.transactionsService.getMonthlySummary(user.id, parseInt(month), parseInt(year));
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
    return this.transactionsService.getCategoryTrends(user.id, months ? parseInt(months, 10) : 6);
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
    const startDate = new Date(start);
    const endDate = new Date(end);
    // Set end to 23:59:59 so the full last day is included
    endDate.setHours(23, 59, 59, 999);
    return this.transactionsService.getRangeOverview(user.id, startDate, endDate);
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
