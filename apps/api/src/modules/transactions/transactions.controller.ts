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
    return this.transactionsService.findAll(user.id, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      category,
      search,
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

  @Patch(':id/category')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.transactionsService.updateCategory(user.id, id, dto.category);
  }
}
