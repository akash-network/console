SET lock_timeout = '3s';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'gpu_request_update';--> statement-breakpoint
RESET lock_timeout;
