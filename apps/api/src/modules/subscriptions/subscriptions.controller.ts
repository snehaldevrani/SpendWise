import { Controller, Get, Patch, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.subscriptionsService.findAll(user.id);
  }

  @Get('leaks')
  getLeaks(@CurrentUser() user: AuthUser) {
    return this.subscriptionsService.getLeaks(user.id);
  }

  @Patch(':id/dismiss')
  dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subscriptionsService.dismiss(user.id, id);
  }

  @Patch(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subscriptionsService.confirm(user.id, id);
  }
}
