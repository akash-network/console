CREATE TABLE "indexer_deferred_indexes" (
	"name" text PRIMARY KEY NOT NULL,
	"definition" text NOT NULL,
	"deferred_at" timestamp with time zone NOT NULL
);
