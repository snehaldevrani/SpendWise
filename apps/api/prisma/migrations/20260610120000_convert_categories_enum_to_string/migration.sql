-- Convert TransactionCategory enum to TEXT to support custom categories
-- Safely handles both transactions and budgets tables

-- Only proceed if the enum still exists
DO $$ 
BEGIN
  -- Check if enum type exists and convert if needed
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'TransactionCategory'
  ) THEN
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

    -- Step 6: Drop the enum type with CASCADE
    DROP TYPE "TransactionCategory" CASCADE;
  END IF;
END $$;
