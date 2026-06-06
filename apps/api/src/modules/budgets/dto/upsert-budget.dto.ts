import { IsEnum, IsNumber, IsInt, Min, Max, IsBoolean, IsOptional } from 'class-validator';
import { TransactionCategory } from '@spendwise/shared-types';

const ALL_CATEGORIES = ['food', 'travel', 'utilities', 'entertainment', 'health', 'shopping', 'subscriptions', 'income', 'other'];

export class UpsertBudgetDto {
  @IsEnum(ALL_CATEGORIES)
  category!: TransactionCategory;

  @IsNumber()
  @Min(1)
  @Max(9_999_999)
  limitAmount!: number;

  /** Set to true to create a budget that applies to all months automatically. */
  @IsBoolean()
  @IsOptional()
  recurring?: boolean;

  /**
   * Required when recurring is false/absent.
   * Omit (or set to 0) when recurring is true — the service will set month=0.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2100)
  year?: number;
}
