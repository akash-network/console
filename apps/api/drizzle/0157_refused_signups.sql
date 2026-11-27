CREATE TABLE "refused_signups" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"browser_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "refused_signups_browser_hash_created_at_idx" ON "refused_signups" USING btree ("browser_hash","created_at");