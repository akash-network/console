CREATE TABLE provider_inventory (
  owner             TEXT PRIMARY KEY,
  host_uri          TEXT NOT NULL,
  is_online         BOOLEAN NOT NULL DEFAULT false,
  is_online_since   TIMESTAMPTZ,

  inventory         JSONB NOT NULL DEFAULT '{}'::jsonb,

  total_available_cpu        BIGINT NOT NULL DEFAULT 0,
  total_available_memory     BIGINT NOT NULL DEFAULT 0,
  total_available_gpu        BIGINT NOT NULL DEFAULT 0,
  total_available_eph        BIGINT NOT NULL DEFAULT 0,
  total_available_persistent BIGINT NOT NULL DEFAULT 0,
  max_node_free_cpu          BIGINT NOT NULL DEFAULT 0,
  max_node_free_memory       BIGINT NOT NULL DEFAULT 0,
  max_node_free_gpu          BIGINT NOT NULL DEFAULT 0,

  gpu_models        TEXT[] NOT NULL DEFAULT '{}',
  storage_classes   TEXT[] NOT NULL DEFAULT '{}',

  self_attributes   JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  audited_by        TEXT[] NOT NULL DEFAULT '{}',

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
) WITH (FILLFACTOR = 70);

CREATE INDEX idx_provider_inventory_online
  ON provider_inventory (owner)
  WHERE is_online AND is_online_since IS NOT NULL;
