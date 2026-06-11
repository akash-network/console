-- Index deploymentGroup.deploymentId (FK with no index — Postgres does not auto-index FKs).
-- Needed by the correlated EXISTS in DeploymentRepository.findAllWithGpuResources so the
-- gpuUnits=1 membership probe is index-driven instead of seq-scanning deploymentGroup.
-- https://github.com/drizzle-team/drizzle-orm/issues/860#issuecomment-2544465387
COMMIT;--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "deployment_group_deployment_id" ON "deploymentGroup" USING btree ("deploymentId");
