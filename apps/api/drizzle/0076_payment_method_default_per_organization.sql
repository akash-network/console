SET lock_timeout = '3s';--> statement-breakpoint
DROP INDEX "payment_methods_user_id_is_default_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_organization_id_is_default_unique" ON "payment_methods" USING btree ("organization_id") WHERE "payment_methods"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_user_id_is_default_unique" ON "payment_methods" USING btree ("user_id","is_default") WHERE "payment_methods"."is_default" = true AND "payment_methods"."organization_id" IS NULL;--> statement-breakpoint
RESET lock_timeout;