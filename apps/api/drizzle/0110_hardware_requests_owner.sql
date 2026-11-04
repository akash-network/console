SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "hardware_requests" ADD COLUMN "owner" varchar(64);--> statement-breakpoint
RESET lock_timeout;
