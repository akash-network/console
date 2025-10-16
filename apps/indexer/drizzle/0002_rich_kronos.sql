DROP INDEX "bid_owner_dseq_gseq_oseq_provider";--> statement-breakpoint
DROP INDEX "lease_owner_dseq_gseq_oseq";--> statement-breakpoint
ALTER TABLE "bid" ALTER COLUMN "bseq" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lease" ALTER COLUMN "bseq" SET DEFAULT 0;--> statement-breakpoint
CREATE INDEX "bid_owner_dseq_gseq_oseq_provider_bseq" ON "bid" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops,"oseq" int4_ops,"provider" text_ops,"bseq" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "lease_owner_dseq_gseq_oseq_bseq_provider" ON "lease" USING btree ("owner" text_ops,"dseq" text_ops,"gseq" int4_ops,"oseq" int4_ops,"bseq" int4_ops,"providerAddress" text_ops);