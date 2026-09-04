CREATE TABLE IF NOT EXISTS "verification_auditor" (
  "address" varchar(255) PRIMARY KEY NOT NULL,
  "status" integer NOT NULL,
  "max_attestation_tier" integer NOT NULL,
  "bond_denom" varchar(255) NOT NULL,
  "bond_amount" numeric(30, 0) NOT NULL,
  "bond_status" integer NOT NULL,
  "metadata_hash" bytea,
  "registered_at" timestamp with time zone NOT NULL,
  "renewal_deadline" timestamp with time zone NOT NULL,
  "discrepancy_count" numeric(20, 0) NOT NULL,
  "bond_unbonding_completion_time" timestamp with time zone,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_auditor_status" ON "verification_auditor" ("status");
CREATE INDEX IF NOT EXISTS "verification_auditor_renewal_deadline" ON "verification_auditor" ("renewal_deadline");

CREATE TABLE IF NOT EXISTS "verification_attestation" (
  "provider" varchar(255) NOT NULL,
  "auditor" varchar(255) NOT NULL,
  "tier" integer NOT NULL,
  "evidence_hash" bytea NOT NULL,
  "fee_denom" varchar(255) NOT NULL,
  "fee_amount" numeric(30, 0) NOT NULL,
  "fee_status" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "status" integer NOT NULL,
  "voided_reason" integer NOT NULL,
  "deposit_denom" varchar(255) NOT NULL,
  "deposit_amount" numeric(30, 0) NOT NULL,
  "deposit_status" integer NOT NULL,
  "audit_escrow_id" numeric(20, 0) NOT NULL,
  "fault_attribution" integer NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  CONSTRAINT "verification_attestation_provider_auditor" PRIMARY KEY ("provider", "auditor")
);

CREATE INDEX IF NOT EXISTS "verification_attestation_provider_status_tier" ON "verification_attestation" ("provider", "status", "tier");
CREATE INDEX IF NOT EXISTS "verification_attestation_expires_at_status" ON "verification_attestation" ("expires_at", "status");
CREATE INDEX IF NOT EXISTS "verification_attestation_audit_escrow_id" ON "verification_attestation" ("audit_escrow_id");

CREATE TABLE IF NOT EXISTS "verification_attestation_capability" (
  "provider" varchar(255) NOT NULL,
  "auditor" varchar(255) NOT NULL,
  "capability" integer NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  CONSTRAINT "verification_attestation_capability_identity" PRIMARY KEY ("provider", "auditor", "capability"),
  CONSTRAINT "verification_attestation_capability_attestation_fkey"
    FOREIGN KEY ("provider", "auditor") REFERENCES "verification_attestation" ("provider", "auditor") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "verification_attestation_capability_capability_provider"
  ON "verification_attestation_capability" ("capability", "provider");

CREATE TABLE IF NOT EXISTS "verification_audit_escrow" (
  "id" numeric(20, 0) PRIMARY KEY NOT NULL,
  "provider" varchar(255) NOT NULL,
  "consumed_by_auditor" varchar(255) NOT NULL,
  "requested_tier" integer NOT NULL,
  "fee_denom" varchar(255) NOT NULL,
  "fee_amount" numeric(30, 0) NOT NULL,
  "fee_status" integer NOT NULL,
  "provider_deposit_denom" varchar(255) NOT NULL,
  "provider_deposit_amount" numeric(30, 0) NOT NULL,
  "provider_deposit_status" integer NOT NULL,
  "status" integer NOT NULL,
  "opened_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "metadata_hash" bytea,
  "settlement_reason" integer NOT NULL,
  "fault_attribution" integer NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_audit_escrow_provider_status" ON "verification_audit_escrow" ("provider", "status");
CREATE INDEX IF NOT EXISTS "verification_audit_escrow_expires_at_status" ON "verification_audit_escrow" ("expires_at", "status");

CREATE TABLE IF NOT EXISTS "verification_audit_escrow_capability" (
  "audit_escrow_id" numeric(20, 0) NOT NULL,
  "capability" integer NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  CONSTRAINT "verification_audit_escrow_capability_identity" PRIMARY KEY ("audit_escrow_id", "capability"),
  CONSTRAINT "verification_audit_escrow_capability_escrow_fkey"
    FOREIGN KEY ("audit_escrow_id") REFERENCES "verification_audit_escrow" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "verification_audit_escrow_capability_capability" ON "verification_audit_escrow_capability" ("capability");

CREATE TABLE IF NOT EXISTS "verification_discrepancy" (
  "id" numeric(20, 0) PRIMARY KEY NOT NULL,
  "provider" varchar(255) NOT NULL,
  "auditor_a" varchar(255) NOT NULL,
  "auditor_a_tier" integer NOT NULL,
  "auditor_b" varchar(255) NOT NULL,
  "auditor_b_tier" integer NOT NULL,
  "detected_at" timestamp with time zone NOT NULL,
  "resolution_status" integer NOT NULL,
  "resolution_proposal_id" numeric(20, 0) NOT NULL,
  "grace_record_id" numeric(20, 0) NOT NULL,
  "resolution_reason" integer NOT NULL,
  "fault_attribution" integer NOT NULL,
  "resolution_evidence_hash" bytea,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_discrepancy_provider_resolution_status" ON "verification_discrepancy" ("provider", "resolution_status");
CREATE INDEX IF NOT EXISTS "verification_discrepancy_auditor_a" ON "verification_discrepancy" ("auditor_a");
CREATE INDEX IF NOT EXISTS "verification_discrepancy_auditor_b" ON "verification_discrepancy" ("auditor_b");

CREATE TABLE IF NOT EXISTS "verification_grace" (
  "id" numeric(20, 0) PRIMARY KEY NOT NULL,
  "provider" varchar(255) NOT NULL,
  "preserved_tier" integer NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "status" integer NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_grace_provider_status" ON "verification_grace" ("provider", "status");
CREATE INDEX IF NOT EXISTS "verification_grace_expires_at_status" ON "verification_grace" ("expires_at", "status");

CREATE TABLE IF NOT EXISTS "verification_grace_discrepancy" (
  "grace_id" numeric(20, 0) NOT NULL,
  "discrepancy_id" numeric(20, 0) NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  CONSTRAINT "verification_grace_discrepancy_identity" PRIMARY KEY ("grace_id", "discrepancy_id"),
  CONSTRAINT "verification_grace_discrepancy_grace_fkey"
    FOREIGN KEY ("grace_id") REFERENCES "verification_grace" ("id") ON DELETE CASCADE,
  CONSTRAINT "verification_grace_discrepancy_discrepancy_fkey"
    FOREIGN KEY ("discrepancy_id") REFERENCES "verification_discrepancy" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "verification_grace_discrepancy_discrepancy_id" ON "verification_grace_discrepancy" ("discrepancy_id");

CREATE TABLE IF NOT EXISTS "verification_provider_bond" (
  "provider" varchar(255) PRIMARY KEY NOT NULL,
  "bonded_denom" varchar(255) NOT NULL,
  "bonded_amount" numeric(30, 0) NOT NULL,
  "required_for_current_tier_denom" varchar(255) NOT NULL,
  "required_for_current_tier_amount" numeric(30, 0) NOT NULL,
  "slashed" boolean NOT NULL,
  "last_slash_time" timestamp with time zone,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_provider_bond_unbonding" (
  "provider" varchar(255) NOT NULL,
  "entry_index" integer NOT NULL,
  "denom" varchar(255) NOT NULL,
  "amount" numeric(30, 0) NOT NULL,
  "completion_time" timestamp with time zone NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  CONSTRAINT "verification_provider_bond_unbonding_identity" PRIMARY KEY ("provider", "entry_index"),
  CONSTRAINT "verification_provider_bond_unbonding_bond_fkey"
    FOREIGN KEY ("provider") REFERENCES "verification_provider_bond" ("provider") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "verification_provider_bond_unbonding_completion_time"
  ON "verification_provider_bond_unbonding" ("completion_time");

CREATE TABLE IF NOT EXISTS "verification_provider_observation" (
  "provider" varchar(255) PRIMARY KEY NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  "effective_tier" integer NOT NULL,
  "max_placement_tier" integer NOT NULL,
  "snapshot_state" varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_provider_tier_stream" (
  "id" smallint PRIMARY KEY NOT NULL,
  "stream_id" uuid NOT NULL DEFAULT gen_random_uuid()
);

INSERT INTO "verification_provider_tier_stream" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "verification_provider_tier_demotion" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "provider" varchar(255) NOT NULL,
  "previous_effective_tier" integer NOT NULL,
  "previous_max_placement_tier" integer NOT NULL,
  "previous_snapshot_state" varchar(255) NOT NULL,
  "current_effective_tier" integer NOT NULL,
  "current_max_placement_tier" integer NOT NULL,
  "current_snapshot_state" varchar(255) NOT NULL,
  "changes" varchar(255)[] NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "verification_provider_tier_demotion_provider_id"
  ON "verification_provider_tier_demotion" ("provider", "id");
CREATE INDEX IF NOT EXISTS "verification_provider_tier_demotion_observed_height"
  ON "verification_provider_tier_demotion" ("observed_height");

CREATE TABLE IF NOT EXISTS "verification_provider_snapshot" (
  "provider" varchar(255) PRIMARY KEY NOT NULL,
  "snapshot_hash" bytea NOT NULL,
  "total_gpus" integer NOT NULL,
  "total_vcpus" integer NOT NULL,
  "total_memory_mb" numeric(20, 0) NOT NULL,
  "total_storage_mb" numeric(20, 0) NOT NULL,
  "active_leases" integer NOT NULL,
  "software_version" varchar(255) NOT NULL,
  "software_signature" bytea,
  "software_identity_version" varchar(255),
  "software_artifact_ref" text,
  "software_digest_algorithm" varchar(255),
  "software_digest" bytea,
  "software_signature_type" varchar(255),
  "software_identity_signature" bytea,
  "software_signature_ref" text,
  "software_public_key_ref" text,
  "posted_at" timestamp with time zone NOT NULL,
  "snapshot_timestamp" timestamp with time zone NOT NULL,
  "compliance_deadline" timestamp with time zone NOT NULL,
  "suspended" boolean NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_provider_snapshot_compliance_deadline_suspended"
  ON "verification_provider_snapshot" ("compliance_deadline", "suspended");
CREATE INDEX IF NOT EXISTS "verification_provider_snapshot_snapshot_timestamp" ON "verification_provider_snapshot" ("snapshot_timestamp");

CREATE TABLE IF NOT EXISTS "provider_maintenance" (
  "provider" varchar(255) NOT NULL,
  "id" numeric(20, 0) NOT NULL,
  "maintenance_type" integer NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "expected_ends_at" timestamp with time zone NOT NULL,
  "opened_at" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone,
  "metadata_hash" bytea,
  "status" integer NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL,
  CONSTRAINT "provider_maintenance_provider_id" PRIMARY KEY ("provider", "id")
);

CREATE INDEX IF NOT EXISTS "provider_maintenance_provider_status" ON "provider_maintenance" ("provider", "status");
CREATE INDEX IF NOT EXISTS "provider_maintenance_starts_at_expected_ends_at" ON "provider_maintenance" ("starts_at", "expected_ends_at");

CREATE TABLE IF NOT EXISTS "verification_params" (
  "id" smallint PRIMARY KEY NOT NULL,
  "params" jsonb NOT NULL,
  "observed_height" integer NOT NULL,
  "observed_block_time" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_reconcile_target" (
  "target_type" varchar(255) NOT NULL,
  "target_key" varchar(255) NOT NULL,
  "requested_height" integer NOT NULL,
  "invalidated" boolean NOT NULL DEFAULT true,
  "claimed_at" timestamp with time zone,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone,
  "last_error" text,
  CONSTRAINT "verification_reconcile_target_identity" PRIMARY KEY ("target_type", "target_key")
);

CREATE INDEX IF NOT EXISTS "verification_reconcile_target_claimed_at_next_attempt_at"
  ON "verification_reconcile_target" ("claimed_at" NULLS FIRST, "next_attempt_at" NULLS FIRST);
CREATE INDEX IF NOT EXISTS "verification_reconcile_target_requested_height" ON "verification_reconcile_target" ("requested_height");

CREATE TABLE IF NOT EXISTS "verification_block_event" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "height" integer NOT NULL,
  "index" integer NOT NULL,
  "type" varchar(255) NOT NULL,
  "data" jsonb NOT NULL,
  "is_processed" boolean NOT NULL DEFAULT false,
  CONSTRAINT "verification_block_event_height_fkey"
    FOREIGN KEY ("height") REFERENCES "block" ("height") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "verification_block_event_height_index" ON "verification_block_event" ("height", "index");
CREATE INDEX IF NOT EXISTS "verification_block_event_height_is_processed" ON "verification_block_event" ("height", "is_processed");
