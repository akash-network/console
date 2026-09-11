-- ANALYZE samples 30k rows, which underestimates the distinct counts of these two FK columns by
-- 10-20x and makes the planner hash the whole node and GPU tables instead of probing their indexes
-- once the gpu breakdown window passes ~120 days. The fractions are stable as the tables grow:
-- each snapshot has ~3.7 nodes and each GPU node ~5.8 GPUs.
ALTER TABLE "providerSnapshotNode" ALTER COLUMN "snapshotId" SET (n_distinct = -0.27);--> statement-breakpoint
ALTER TABLE "providerSnapshotNodeGPU" ALTER COLUMN "snapshotNodeId" SET (n_distinct = -0.17);--> statement-breakpoint

-- Statistics on lower(vendor)/lower(name) so the case-insensitive gpu breakdown filter is not
-- estimated at a handful of rows. Expression statistics need Postgres 14.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 140000 THEN
    EXECUTE 'CREATE STATISTICS IF NOT EXISTS provider_snapshot_node_gpu_lower_vendor_name (mcv) ON lower(vendor), lower(name) FROM "providerSnapshotNodeGPU"';
  END IF;
END
$$;--> statement-breakpoint

ANALYZE "providerSnapshotNode";--> statement-breakpoint
ANALYZE "providerSnapshotNodeGPU";
