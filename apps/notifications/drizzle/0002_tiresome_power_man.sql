CREATE TABLE "block_cursor" (
	"id" text PRIMARY KEY DEFAULT 'latest' NOT NULL,
	"last_processed_block" bigint NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
