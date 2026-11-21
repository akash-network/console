SET lock_timeout = '3s';--> statement-breakpoint
CREATE TABLE "template_scores" (
	"source" "template_source" NOT NULL,
	"template_ref" varchar(255) NOT NULL,
	"popular_score" double precision DEFAULT 0 NOT NULL,
	"trending_score" double precision DEFAULT 0 NOT NULL,
	"weekly_deployers" integer DEFAULT 0 NOT NULL,
	"is_trending" boolean DEFAULT false NOT NULL,
	"breakdown" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_scores_source_template_ref_pk" PRIMARY KEY("source","template_ref")
);
--> statement-breakpoint
CREATE INDEX "templateFavorite_templateId_userId_idx" ON "templateFavorite" USING btree ("templateId","userId");--> statement-breakpoint
CREATE INDEX "template_usage_events_network_action_created_idx" ON "template_usage_events" USING btree ("network","action","created_at");--> statement-breakpoint
RESET lock_timeout;
