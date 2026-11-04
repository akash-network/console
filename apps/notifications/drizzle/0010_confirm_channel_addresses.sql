CREATE TABLE "address_confirmation_emails" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channel_pending_addresses" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"notification_channel_id" uuid NOT NULL,
	"address" varchar NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_channel_pending_addresses" ADD CONSTRAINT "notification_channel_pending_addresses_notification_channel_id_notification_channels_id_fk" FOREIGN KEY ("notification_channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_address_confirmation_emails_user_id_created_at" ON "address_confirmation_emails" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_address_confirmation_emails_address_created_at" ON "address_confirmation_emails" USING btree ("address","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_channel_pending_addresses_channel_address" ON "notification_channel_pending_addresses" USING btree ("notification_channel_id","address");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_channel_pending_addresses_token_hash" ON "notification_channel_pending_addresses" USING btree ("token_hash");