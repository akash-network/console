-- One-time backfill for always-on deployment funding (CON-734): rows where the owner turned the
-- old per-deployment toggle off are switched back on. Runtime-limited deployments are unaffected
-- in behaviour: funding stops at their deadline regardless of this flag. Closed deployments are
-- left as they are, since every funding query filters on closed = false.
SET lock_timeout = '3s';--> statement-breakpoint
UPDATE "deployment_settings" SET "auto_top_up_enabled" = true, "updated_at" = now() WHERE "auto_top_up_enabled" = false AND "closed" = false;--> statement-breakpoint
RESET lock_timeout;
