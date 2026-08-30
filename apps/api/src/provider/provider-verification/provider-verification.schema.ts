import { z } from "@hono/zod-openapi";

const NullableTimestampSchema = z.string().datetime().nullable();
const NullableBase64Schema = z.string().nullable().openapi({ description: "Base64-encoded bytes, or null when the chain field is empty" });
const UIntStringSchema = z.string().regex(/^\d+$/);

export const ProviderVerificationTierSchema = z.enum(["L0", "L1", "L2", "L3", "L4", "unknown"]);
export const ProviderVerificationCapabilitySchema = z.enum([
  "unspecified",
  "tee_hardware_attestation",
  "confidential_computing",
  "persistent_storage",
  "bare_metal",
  "unknown"
]);
export type ProviderVerificationTier = z.infer<typeof ProviderVerificationTierSchema>;
export type ProviderVerificationCapability = z.infer<typeof ProviderVerificationCapabilitySchema>;

const CoinSchema = z.object({
  denom: z.string(),
  amount: UIntStringSchema
});

const AttestationSchema = z.object({
  provider: z.string(),
  auditor: z.string(),
  tier: ProviderVerificationTierSchema,
  capabilities: z.array(ProviderVerificationCapabilitySchema),
  evidenceHash: NullableBase64Schema,
  fee: CoinSchema.nullable(),
  feeStatus: z.enum(["unspecified", "escrowed", "released_to_auditor", "returned_to_provider", "unknown"]),
  createdAt: NullableTimestampSchema,
  expiresAt: NullableTimestampSchema,
  status: z.enum(["unspecified", "valid", "voided", "expired", "revoked", "removed", "unknown"]),
  voidedReason: z.enum(["unspecified", "discrepancy", "governance", "bond_withdrawn", "bond_slashed", "unknown"]),
  deposit: CoinSchema.nullable(),
  depositStatus: z.enum(["unspecified", "escrowed", "pending_discrepancy", "returned_to_auditor", "slashed", "unknown"]),
  auditEscrowId: UIntStringSchema,
  faultAttribution: z.enum(["unspecified", "provider_fault", "auditor_fault", "shared_fault", "no_fault", "inconclusive", "unknown"])
});

const UnbondingEntrySchema = z.object({
  amount: CoinSchema.nullable(),
  completionTime: NullableTimestampSchema
});

const ProviderBondSchema = z.object({
  provider: z.string(),
  bondedAmount: CoinSchema.nullable(),
  requiredForCurrentTier: CoinSchema,
  unbondingEntries: z.array(UnbondingEntrySchema),
  slashed: z.boolean(),
  lastSlashTime: NullableTimestampSchema
});

const SoftwareIdentitySchema = z.object({
  version: z.string(),
  artifactRef: z.string(),
  digestAlgorithm: z.string(),
  digest: NullableBase64Schema,
  signatureType: z.string(),
  signature: NullableBase64Schema,
  signatureRef: z.string(),
  publicKeyRef: z.string()
});

const ResourceSummarySchema = z.object({
  totalGpus: z.number().int().nonnegative(),
  totalVcpus: z.number().int().nonnegative(),
  totalMemoryMb: UIntStringSchema,
  totalStorageMb: UIntStringSchema,
  activeLeases: z.number().int().nonnegative(),
  softwareVersion: z.string(),
  softwareSignature: NullableBase64Schema,
  softwareIdentity: SoftwareIdentitySchema.nullable()
});

const ProviderSnapshotSchema = z.object({
  provider: z.string(),
  snapshotHash: NullableBase64Schema,
  resourceSummary: ResourceSummarySchema.nullable(),
  postedAt: NullableTimestampSchema,
  snapshotTimestamp: NullableTimestampSchema,
  complianceDeadline: NullableTimestampSchema,
  suspended: z.boolean()
});

const AuditEscrowSchema = z.object({
  id: UIntStringSchema,
  provider: z.string(),
  consumedByAuditor: z.string().nullable(),
  requestedTier: ProviderVerificationTierSchema,
  requestedCapabilities: z.array(ProviderVerificationCapabilitySchema),
  fee: CoinSchema.nullable(),
  feeStatus: z.enum(["unspecified", "escrowed", "released_to_auditor", "returned_to_provider", "unknown"]),
  providerDeposit: CoinSchema.nullable(),
  providerDepositStatus: z.enum(["unspecified", "escrowed", "returned_to_provider", "slashed", "unknown"]),
  status: z.enum(["unspecified", "open", "consumed", "cancelled", "expired", "settled", "unknown"]),
  openedAt: NullableTimestampSchema,
  consumedAt: NullableTimestampSchema,
  expiresAt: NullableTimestampSchema,
  metadataHash: NullableBase64Schema,
  settlementReason: z.enum(["unspecified", "cancelled_unconsumed", "expired_unconsumed", "provider_fault", "no_fault", "unknown"]),
  faultAttribution: z.enum(["unspecified", "provider_fault", "auditor_fault", "shared_fault", "no_fault", "inconclusive", "unknown"])
});

const VerificationGraceSchema = z.object({
  id: UIntStringSchema,
  provider: z.string(),
  preservedTier: ProviderVerificationTierSchema,
  sourceDiscrepancyIds: z.array(UIntStringSchema),
  startedAt: NullableTimestampSchema,
  expiresAt: NullableTimestampSchema,
  status: z.enum(["unspecified", "active", "expired", "terminated", "unknown"])
});

const ProviderMaintenanceRecordSchema = z.object({
  id: UIntStringSchema,
  provider: z.string(),
  maintenanceType: z.enum(["unspecified", "planned", "emergency", "security", "network", "capacity", "unknown"]),
  startsAt: NullableTimestampSchema,
  expectedEndsAt: NullableTimestampSchema,
  openedAt: NullableTimestampSchema,
  closedAt: NullableTimestampSchema,
  metadataHash: NullableBase64Schema
});

const ProviderMaintenanceSchema = z.object({
  record: ProviderMaintenanceRecordSchema.nullable(),
  status: z.enum(["unspecified", "scheduled", "active", "elapsed", "closed", "unknown"])
});

const DiscrepancySchema = z.object({
  id: UIntStringSchema,
  provider: z.string(),
  auditorA: z.string(),
  auditorATier: ProviderVerificationTierSchema,
  auditorB: z.string(),
  auditorBTier: ProviderVerificationTierSchema,
  timestamp: NullableTimestampSchema,
  resolutionStatus: z.enum(["unspecified", "pending", "resolved", "timed_out", "unknown"]),
  resolutionProposalId: UIntStringSchema,
  graceRecordId: UIntStringSchema,
  resolutionReason: z.enum([
    "unspecified",
    "auditor_a_correct",
    "auditor_b_correct",
    "both_auditors_wrong",
    "provider_fault",
    "shared_fault",
    "evidence_inconclusive",
    "governance_timeout_review",
    "unknown"
  ]),
  faultAttribution: z.enum(["unspecified", "provider_fault", "auditor_fault", "shared_fault", "no_fault", "inconclusive", "unknown"]),
  resolutionEvidenceHash: NullableBase64Schema
});

export const ProviderVerificationCompletenessSchema = z.object({
  params: z.boolean(),
  attestations: z.boolean(),
  graces: z.boolean(),
  snapshot: z.boolean(),
  bond: z.boolean(),
  auditEscrows: z.boolean(),
  maintenance: z.boolean(),
  discrepancies: z.boolean()
});

export const ProviderVerificationSnapshotStateSchema = z.enum(["unknown", "not_posted", "current", "stale", "suspended"]);
const MaintenanceStateSchema = z.enum(["unknown", "none", "scheduled", "active"]);
const ReviewStateSchema = z.enum(["unknown", "none", "under_review", "grace"]);

export const ProviderVerificationListViewSchema = z.object({
  provider: z.string(),
  moduleActive: z.boolean().nullable(),
  summary: z.object({
    effectiveTier: ProviderVerificationTierSchema.nullable().openapi({ description: "Tier used by the chain tier gate, including active discrepancy grace" }),
    validAuditorCount: z.number().int().nonnegative().nullable(),
    capabilities: z.array(ProviderVerificationCapabilitySchema).nullable(),
    snapshotState: ProviderVerificationSnapshotStateSchema,
    maintenanceState: MaintenanceStateSchema,
    reviewState: ReviewStateSchema
  }),
  observedAt: z.string().datetime(),
  observedHeight: UIntStringSchema
});

export const ProviderVerificationViewSchema = z.object({
  provider: z.string(),
  providerDeclaredTier: z.string().nullable().openapi({ description: "Legacy, self-declared provider tier attribute; not an AEP-86 attestation" }),
  moduleActive: z.boolean().nullable(),
  provenance: z.object({
    providerTier: z.literal("provider self-declared"),
    inventory: z.literal("provider-signed inventory"),
    attestations: z.literal("auditor-attested")
  }),
  summary: z.object({
    bestAttestedTier: ProviderVerificationTierSchema.nullable(),
    effectiveTier: ProviderVerificationTierSchema.nullable().openapi({ description: "Tier used by the chain tier gate, including active discrepancy grace" }),
    capabilities: z.array(ProviderVerificationCapabilitySchema).nullable(),
    validAttestationCount: z.number().int().nonnegative().nullable(),
    validAuditorCount: z.number().int().nonnegative().nullable(),
    validAuditors: z.array(z.string()).nullable(),
    snapshotState: ProviderVerificationSnapshotStateSchema,
    maintenanceState: MaintenanceStateSchema,
    reviewState: ReviewStateSchema
  }),
  attestations: z.array(AttestationSchema),
  bond: ProviderBondSchema.nullable(),
  snapshot: ProviderSnapshotSchema.nullable(),
  grace: VerificationGraceSchema.nullable(),
  auditEscrows: z.array(AuditEscrowSchema),
  maintenance: z.array(ProviderMaintenanceSchema),
  discrepancies: z.array(DiscrepancySchema),
  observedAt: z.string().datetime(),
  observedHeight: UIntStringSchema,
  completeness: ProviderVerificationCompletenessSchema
});

export type ProviderVerificationListView = z.infer<typeof ProviderVerificationListViewSchema>;
export type ProviderVerificationView = z.infer<typeof ProviderVerificationViewSchema>;
export type ProviderVerificationViewCompleteness = z.infer<typeof ProviderVerificationCompletenessSchema>;
