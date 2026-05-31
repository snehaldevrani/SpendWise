import { IsEnum, IsNumber, IsInt, Min, Max } from 'class-validator';
import { TransactionCategory } from '@spendwise/shared-types';

const ALL_CATEGORIES = ['food', 'travel', 'utilities', 'entertainment', 'health', 'shopping', 'subscriptions', 'income', 'other'];

export class UpsertBudgetDto {
  @IsEnum(ALL_CATEGORIES)
  category!: TransactionCategory;

  @IsNumber()
  @Min(1)
  limitAmount!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;
}
