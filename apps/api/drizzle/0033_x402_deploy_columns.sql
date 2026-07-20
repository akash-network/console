ALTER TABLE "x402_transactions" ADD COLUMN "deployment_dseq" varchar(100);--> statement-breakpoint
ALTER TABLE "x402_transactions" ADD COLUMN "deploy_failed" boolean DEFAULT false NOT NULL;