CREATE TABLE "cosmos"."message_dead_letters" (
	"height" bigint NOT NULL,
	"tx_index" integer NOT NULL,
	"index" integer NOT NULL,
	"type_id" integer NOT NULL,
	"raw" "bytea" NOT NULL,
	"error" text NOT NULL,
	CONSTRAINT "message_dead_letters_height_tx_index_index_pk" PRIMARY KEY("height","tx_index","index")
);
--> statement-breakpoint
ALTER TABLE "cosmos"."message_dead_letters" ADD CONSTRAINT "message_dead_letters_type_id_message_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "cosmos"."message_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_dead_letters_type_id_idx" ON "cosmos"."message_dead_letters" USING btree ("type_id");