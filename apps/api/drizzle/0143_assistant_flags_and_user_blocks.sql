CREATE TYPE "public"."assistant_turn_flag" AS ENUM('on_topic', 'off_topic', 'manipulation');--> statement-breakpoint
CREATE TYPE "public"."assistant_user_block_source" AS ENUM('automatic', 'admin');--> statement-breakpoint
CREATE TABLE "assistant_user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "assistant_user_block_source" NOT NULL,
	"blocked_until" timestamp with time zone,
	"flagged_turn_count" integer,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone,
	"lifted_by" text
);
--> statement-breakpoint
ALTER TABLE "assistant_user_usage" ADD COLUMN "day_flagged_turn_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_turn_traces" ADD COLUMN "flag" "assistant_turn_flag";--> statement-breakpoint
ALTER TABLE "assistant_user_blocks" ADD CONSTRAINT "assistant_user_blocks_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_user_blocks_user_id_created_at_idx" ON "assistant_user_blocks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_user_blocks_automatic_user_id_blocked_until_unique" ON "assistant_user_blocks" USING btree ("user_id","blocked_until") WHERE "assistant_user_blocks"."source" = 'automatic';