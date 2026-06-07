import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomCategoriesService } from './custom-categories.service';
import { CreateCustomCategoryDto } from './dto/create-custom-category.dto';
import { UpdateCustomCategoryDto } from './dto/update-custom-category.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('custom-categories')
@ApiBearerAuth()
@Controller('custom-categories')
export class CustomCategoriesController {
  constructor(private service: CustomCategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomCategoryDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomCategoryDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.delete(user.id, id);
  }
}
