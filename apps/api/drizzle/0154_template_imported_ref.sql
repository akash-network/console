SET lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "imported_ref" varchar(255);--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN "imported_content_hash" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "template_imported_ref_unique" ON "template" USING btree ("imported_ref");--> statement-breakpoint
RESET lock_timeout;
