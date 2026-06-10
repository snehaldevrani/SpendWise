-- Convert TransactionCategory enum to TEXT to support custom categories
-- This conversion handles both transactions and budgets tables

-- Step 1: Create temporary columns with TEXT type
ALTER TABLE "transactions" ADD COLUMN "category_new" TEXT;
ALTER TABLE "budgets" ADD COLUMN "category_new" TEXT;

-- Step 2: Copy data from enum columns to temporary text columns
UPDATE "transactions" SET "category_new" = "category"::text;
UPDATE "budgets" SET "category_new" = "category"::text;

-- Step 3: Drop the old enum columns
ALTER TABLE "transactions" DROP COLUMN "category";
ALTER TABLE "budgets" DROP COLUMN "category";

-- Step 4: Rename temporary columns to original names
ALTER TABLE "transactions" RENAME COLUMN "category_new" TO "category";
ALTER TABLE "budgets" RENAME COLUMN "category_new" TO "category";

-- Step 5: Set constraints on the new columns
ALTER TABLE "transactions" ALTER COLUMN "category" SET DEFAULT 'other';
ALTER TABLE "transactions" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "budgets" ALTER COLUMN "category" SET NOT NULL;

-- Step 6: Drop the enum type with CASCADE to remove dependencies
DROP TYPE "TransactionCategory" CASCADE;
