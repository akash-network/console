-- At the default 10% this table went months between analyzes, so an address that turned busy since the last one
-- was estimated at ~1,400 references and its transactions were sorted in full instead of read from the height index.
ALTER TABLE "addressReference" SET (autovacuum_analyze_scale_factor = 0.002);--> statement-breakpoint

ANALYZE "addressReference";
