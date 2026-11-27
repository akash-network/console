CREATE TABLE "trial_cards" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"card_hash" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trial_cards_card_hash_unique" ON "trial_cards" USING btree ("card_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_cards_user_id_unique" ON "trial_cards" USING btree ("user_id");