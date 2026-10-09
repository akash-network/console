import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas";

/** What a card reported about itself, before any catalog lookup: the model is resolved on read so a grown alias table needs no backfill. */
export type DetectedGpuRecord = {
  rawName: string;
  pciDeviceId: string | null;
  memoryMb: number;
  count: number;
};

/** Which tool answered the probe; `none` is a container that ran it and had neither, which is a reading rather than a gap. */
export const GPU_PROBE_SOURCES = ["nvidia-smi", "rocm-smi", "none"] as const;

export type GpuProbeSource = (typeof GPU_PROBE_SOURCES)[number];

export type LeaseGpuReading = {
  gseq: number;
  oseq: number;
  provider: string;
  service: string;
  /** Empty for a container that answered without a GPU tool, which is what stops the sweep re-enqueuing it forever. */
  gpus: DetectedGpuRecord[];
  driverVersion: string | null;
  source: GpuProbeSource;
  detectedAt: string;
};

export type GpuOfferAttribute = { key: string; value: string };

/** One gpu resource unit of the bid a lease was created from, kept raw so a new offer format needs a parser change rather than another chain read. */
export type OfferedGpuResource = {
  resourceId: number;
  replicas: number;
  unitsPerReplica: number;
  attributes: GpuOfferAttribute[];
};

export type LeaseGpuOffer = {
  gseq: number;
  oseq: number;
  provider: string;
  bseq: number;
  resources: OfferedGpuResource[];
  recordedAt: string;
};

export const deploymentCloseReasonEnum = pgEnum("deployment_close_reason", [
  "no_longer_needed",
  "cost_or_budget",
  "migrating_elsewhere",
  "performance_or_reliability",
  "testing_or_project_complete",
  "other"
]);

export type DeploymentCloseReason = (typeof deploymentCloseReasonEnum.enumValues)[number];

export const MAX_CLOSE_REASON_DETAILS_LENGTH = 1000;

export const DeploymentSettings = pgTable(
  "deployment_settings",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id),
    projectId: uuid("project_id"),
    dseq: varchar("dseq").notNull(),
    autoTopUpEnabled: boolean("auto_top_up_enabled").notNull(),
    closed: boolean("closed").notNull().default(false),
    lastFundedAt: timestamp("last_funded_at"),
    runtimeLimitHours: integer("runtime_limit_hours"),
    sdl: text("sdl"),
    /** Unsized on purpose: the length a caller may supply is bounded by the request schema, while a name the console derives from an SDL is bounded by nothing the caller controls. */
    name: text("name"),
    /** A JWE compact serialization, so `text` rather than a sized column: the plaintext it carries is bounded, its ciphertext is not sized by anything this schema knows. */
    sealedSecrets: text("sealed_secrets"),
    manifestVersion: varchar("manifest_version", { length: 64 }),
    runtimeEndsAt: timestamp("runtime_ends_at", { withTimezone: true }),
    runtimeEndingNotifiedFor: timestamp("runtime_ending_notified_for", { withTimezone: true }),
    providerUnreachableNotifiedFor: timestamp("provider_unreachable_notified_for", { withTimezone: true }),
    /** Null until the probe has read a lease, so an unread deployment is never mistaken for one running no gpu. */
    detectedGpus: jsonb("detected_gpus").$type<LeaseGpuReading[]>(),
    /** Null until the winning bid of a gpu lease has been read, so an unrecorded deployment is never mistaken for one offered no gpu. */
    offeredGpus: jsonb("offered_gpus").$type<LeaseGpuOffer[]>(),
    /** Null for a close the user gave no reason for, which includes every close the console makes on its own. */
    closeReason: deploymentCloseReasonEnum("close_reason"),
    closeReasonDetails: text("close_reason_details"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  table => ({
    dseqUserIdIdx: unique("dseq_user_id_idx").on(table.dseq, table.userId),
    idAutoTopUpEnabledClosedIdx: index("id_auto_top_up_enabled_closed_idx").on(table.id, table.autoTopUpEnabled, table.closed),
    /** Backs the per-user walk of deployments holding a secret, so a re-key costs that user's rows and not the table. */
    userIdIdSealedSecretsIdx: index("user_id_id_sealed_secrets_idx")
      .on(table.userId, table.id)
      .where(sql`${table.sealedSecrets} IS NOT NULL`),
    detectedGpusIdx: index("deployment_settings_detected_gpus_idx")
      .using("gin", sql`${table.detectedGpus} jsonb_path_ops`)
      .where(sql`${table.detectedGpus} IS NOT NULL`),
    /** Backs a search of one user's deployments by name, so it reads that user's named rows and not the table. */
    userIdNamedIdx: index("deployment_settings_user_id_named_idx")
      .on(table.userId)
      .where(sql`${table.name} IS NOT NULL`),
    /** Backs filing a user's rows into their personal organization on every login, so it reads only the rows still waiting for one. */
    userIdUnadoptedIdx: index("deployment_settings_user_id_unadopted_idx")
      .on(table.userId)
      .where(sql`${table.organizationId} IS NULL`),
    organizationIdProjectIdIdx: index("deployment_settings_organization_id_project_id_idx").on(table.organizationId, table.projectId),
    projectFk: foreignKey({
      name: "deployment_settings_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    })
  })
);
