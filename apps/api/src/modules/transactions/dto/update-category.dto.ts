import { IsEnum } from 'class-validator';
import { TransactionCategory } from '@spendwise/shared-types';

export class UpdateCategoryDto {
  @IsEnum(['food', 'travel', 'utilities', 'entertainment', 'health', 'shopping', 'subscriptions', 'income', 'other'])
  category!: TransactionCategory;
}
