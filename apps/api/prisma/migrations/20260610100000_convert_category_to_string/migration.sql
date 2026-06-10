-- Convert TransactionCategory enum to TEXT to allow custom categories
-- Step 1: Create a backup column
ALTER TABLE "transactions" ADD COLUMN "category_temp" TEXT;

-- Step 2: Copy data from enum column to text column (casting enum to text)
UPDATE "transactions" SET "category_temp" = "category"::text;

-- Step 3: Drop the old enum column
ALTER TABLE "transactions" DROP COLUMN "category";

-- Step 4: Rename the temp column to the original name
ALTER TABLE "transactions" RENAME COLUMN "category_temp" TO "category";

-- Step 5: Set the default value
ALTER TABLE "transactions" ALTER COLUMN "category" SET DEFAULT 'other';

-- Step 6: Make column NOT NULL
ALTER TABLE "transactions" ALTER COLUMN "category" SET NOT NULL;

-- Step 7: Drop the unused enum types (do this after confirming no other tables use them)
DROP TYPE IF EXISTS "TransactionCategory";
