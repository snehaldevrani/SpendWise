import { IsString, IsNumber, IsInt, Min, Max, IsBoolean, IsOptional, MinLength, Matches } from 'class-validator';
import { TransactionCategory } from '@spendwise/shared-types';

export class UpsertBudgetDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9_-]+$/, { message: 'Category must contain only lowercase letters, numbers, underscores, and hyphens' })
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
