SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "template" ALTER COLUMN "userId" DROP NOT NULL;--> statement-breakpoint
RESET lock_timeout;
