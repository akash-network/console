ALTER TABLE "user_wallets" ADD COLUMN "review_status" varchar;
UPDATE "user_wallets" SET "review_status" = 'approved' WHERE "review_status" IS NULL;