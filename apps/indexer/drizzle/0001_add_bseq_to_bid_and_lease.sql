ALTER TABLE "bid" ADD COLUMN "bseq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lease" ADD COLUMN "bseq" integer DEFAULT 0 NOT NULL;