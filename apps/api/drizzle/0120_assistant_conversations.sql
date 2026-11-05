CREATE TABLE "assistant_user_usage" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"day_message_count" integer DEFAULT 0 NOT NULL,
	"minute_started_at" timestamp with time zone NOT NULL,
	"minute_message_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_daily_token_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"completion_tokens" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_pending_turns" (
	"conversation_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_user_usage" ADD CONSTRAINT "assistant_user_usage_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_pending_turns" ADD CONSTRAINT "assistant_pending_turns_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_pending_turns_expires_at_idx" ON "assistant_pending_turns" USING btree ("expires_at");