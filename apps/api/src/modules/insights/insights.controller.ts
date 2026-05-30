import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('insights')
@ApiBearerAuth()
@Controller('insights')
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get('current')
  getCurrent(@CurrentUser() user: AuthUser) {
    return this.insightsService.getCurrent(user.id);
  }

  @Get()
  getAll(@CurrentUser() user: AuthUser) {
    return this.insightsService.getAll(user.id);
  }
}
