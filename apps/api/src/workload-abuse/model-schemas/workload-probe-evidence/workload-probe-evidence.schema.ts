import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type ProbeEvidenceAccelerator = {
  name: string;
  utilPct: number;
  memUsedMb: number;
  memTotalMb: number;
  processes: Array<{ pid: number; name: string; vramMb: number }>;
};

export type ProbeEvidenceArtifact = { path: string; sizeBytes: number };

export type ProbeEvidenceProcessOrigin = { pid: number; ppid: number; comm: string; startedAtEpochMs: number };

export type ProbeEvidenceNetShape = {
  listenPorts: number[];
  established: Array<{ localPort: number; remoteIp: string; remotePort: number; count: number }>;
};

export type ProbeEvidenceBehaviouralFinding = { signal: string; detail: Record<string, unknown> };

export const WorkloadProbeEvidence = pgTable(
  "workload_probe_evidence",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    walletId: integer("wallet_id").notNull(),
    dseq: varchar("dseq").notNull(),
    provider: text("provider").notNull(),
    service: varchar("service", { length: 255 }).notNull(),
    probeStatus: varchar("probe_status", { length: 64 }).notNull(),
    verdict: varchar("verdict", { length: 16 }).notNull(),
    detectionId: uuid("detection_id"),
    accelerator: jsonb("accelerator").$type<ProbeEvidenceAccelerator[] | null>(),
    artifacts: jsonb("artifacts").$type<ProbeEvidenceArtifact[] | null>(),
    processOrigins: jsonb("process_origins").$type<ProbeEvidenceProcessOrigin[] | null>(),
    netShape: jsonb("net_shape").$type<ProbeEvidenceNetShape | null>(),
    behaviouralFindings: jsonb("behavioural_findings").$type<ProbeEvidenceBehaviouralFinding[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    walletDseqCreatedIdx: index("workload_probe_evidence_wallet_dseq_created_idx").on(table.walletId, table.dseq, table.createdAt),
    createdIdx: index("workload_probe_evidence_created_idx").on(table.createdAt)
  })
);
