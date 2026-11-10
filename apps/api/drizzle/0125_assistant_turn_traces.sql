CREATE TYPE "public"."assistant_turn_outcome" AS ENUM('running', 'answered', 'recovered', 'fallback', 'timed_out', 'awaiting_browser', 'model_failed', 'failed', 'cancelled', 'limited');--> statement-breakpoint
CREATE TABLE "assistant_turn_traces" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"conversation_id" uuid NOT NULL,
	"page" varchar(500),
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"outcome" "assistant_turn_outcome" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"first_token_ms" integer,
	"duration_ms" integer NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cards" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_turn_traces" ADD CONSTRAINT "assistant_turn_traces_user_id_userSetting_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."userSetting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_turn_traces" ADD CONSTRAINT "assistant_turn_traces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_turn_traces_user_id_started_at_idx" ON "assistant_turn_traces" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "assistant_turn_traces_conversation_id_idx" ON "assistant_turn_traces" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "assistant_turn_traces_started_at_idx" ON "assistant_turn_traces" USING btree ("started_at");