-- Convert TransactionCategory enum to TEXT to allow custom categories
-- Must convert both transactions and budgets tables

-- Convert transactions.category
ALTER TABLE "transactions" ADD COLUMN "category_temp" TEXT;
UPDATE "transactions" SET "category_temp" = "category"::text;
ALTER TABLE "transactions" DROP COLUMN "category";
ALTER TABLE "transactions" RENAME COLUMN "category_temp" TO "category";
ALTER TABLE "transactions" ALTER COLUMN "category" SET DEFAULT 'other';
ALTER TABLE "transactions" ALTER COLUMN "category" SET NOT NULL;

-- Convert budgets.category
ALTER TABLE "budgets" ADD COLUMN "category_temp" TEXT;
UPDATE "budgets" SET "category_temp" = "category"::text;
ALTER TABLE "budgets" DROP COLUMN "category";
ALTER TABLE "budgets" RENAME COLUMN "category_temp" TO "category";
ALTER TABLE "budgets" ALTER COLUMN "category" SET NOT NULL;

-- Drop the unused enum type
DROP TYPE "TransactionCategory";
