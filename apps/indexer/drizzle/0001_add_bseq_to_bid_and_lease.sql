-- Step 1: Add column as nullable with default (minimal lock)
ALTER TABLE "bid" ADD COLUMN "bseq" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "bseq" integer DEFAULT 0;--> statement-breakpoint

-- Step 2: Add NOT NULL constraint (validates quickly since all rows have values)
ALTER TABLE "bid" ALTER COLUMN "bseq" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lease" ALTER COLUMN "bseq" SET NOT NULL;