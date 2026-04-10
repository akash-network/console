import { QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import type { BidScreeningRequest } from "@src/provider/http-schemas/bid-screening.schema";

interface ProviderMatchRow {
  owner: string;
  hostUri: string;
  leaseCount: number;
  availableCpu: number;
  availableMemory: number;
  availableGpu: number;
  availableEphemeralStorage: number;
  availablePersistentStorage: number;
}

interface ConstraintCheckRow {
  c: string;
}

export interface Constraint {
  name: string;
  count: number;
  actionableFeedback: string;
}

export interface BidScreeningResult {
  providers: ProviderMatchRow[];
  total: number;
  queryTimeMs: number;
  constraints?: Constraint[];
}

interface AggregatedResources {
  totalCpu: number;
  totalMemory: number;
  totalGpu: number;
  totalEphemeralStorage: number;
  totalPersistentStorage: number;
  maxPerReplicaGpu: number;
  hasGpuAttributes: boolean;
  gpuVendor?: string;
  gpuModel?: string;
  gpuInterface?: string;
  gpuMemorySize?: string;
  hasPersistentStorage: boolean;
  persistentStorageClass?: string;
}

@singleton()
export class BidScreeningService {
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  async findMatchingProviders(input: BidScreeningRequest["data"]): Promise<BidScreeningResult> {
    const agg = this.aggregateResources(input.resources);
    const limit = input.limit ?? 50;

    const start = performance.now();

    const { sql: countSql, replacements: countReplacements } = this.buildQuery(agg, input.requirements, undefined, true);
    const { sql: mainSql, replacements: mainReplacements } = this.buildQuery(agg, input.requirements, limit, false);

    const [[countRow], providers] = await Promise.all([
      this.#chainDb.query<{ total: string }>(countSql, { type: QueryTypes.SELECT, replacements: countReplacements }),
      this.#chainDb.query<ProviderMatchRow>(mainSql, { type: QueryTypes.SELECT, replacements: mainReplacements })
    ]);

    const total = Number(countRow?.total ?? 0);

    const result: BidScreeningResult = { providers, total, queryTimeMs: 0 };

    if (total === 0) {
      result.constraints = await this.diagnoseConstraints(agg, input.requirements);
    }

    result.queryTimeMs = Math.round((performance.now() - start) * 100) / 100;

    return result;
  }

  aggregateResources(resources: BidScreeningRequest["data"]["resources"]): AggregatedResources {
    let totalCpu = 0;
    let totalMemory = 0;
    let totalGpu = 0;
    let totalEphemeralStorage = 0;
    let totalPersistentStorage = 0;
    let maxPerReplicaGpu = 0;
    let gpuVendor: string | undefined;
    let gpuModel: string | undefined;
    let gpuInterface: string | undefined;
    let gpuMemorySize: string | undefined;
    let persistentStorageClass: string | undefined;

    for (const ru of resources) {
      totalCpu += ru.cpu * ru.count;
      totalMemory += ru.memory * ru.count;
      totalGpu += ru.gpu * ru.count;
      totalEphemeralStorage += ru.ephemeralStorage * ru.count;
      totalPersistentStorage += (ru.persistentStorage ?? 0) * ru.count;

      if (ru.gpu > 0) {
        maxPerReplicaGpu = Math.max(maxPerReplicaGpu, ru.gpu);
        // Akash SDL uses a single GPU spec per placement — last resource unit's attributes win
        if (ru.gpuAttributes) {
          gpuVendor = ru.gpuAttributes.vendor;
          gpuModel = ru.gpuAttributes.model;
          gpuInterface = ru.gpuAttributes.interface;
          gpuMemorySize = ru.gpuAttributes.memorySize;
        }
      }

      if (ru.persistentStorage && ru.persistentStorageClass) {
        persistentStorageClass = ru.persistentStorageClass;
      }
    }

    return {
      totalCpu,
      totalMemory,
      totalGpu,
      totalEphemeralStorage,
      totalPersistentStorage,
      maxPerReplicaGpu,
      hasGpuAttributes: gpuVendor !== undefined,
      gpuVendor,
      gpuModel,
      gpuInterface,
      gpuMemorySize,
      hasPersistentStorage: totalPersistentStorage > 0,
      persistentStorageClass
    };
  }

  buildQuery(
    agg: AggregatedResources,
    requirements: BidScreeningRequest["data"]["requirements"],
    limit: number | undefined,
    isCount: boolean
  ): { sql: string; replacements: Record<string, unknown> } {
    const replacements: Record<string, unknown> = {
      totalCpu: agg.totalCpu,
      totalMemory: agg.totalMemory,
      totalEphemeralStorage: agg.totalEphemeralStorage
    };

    const joins: string[] = [`INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"`];

    const wheres: string[] = [
      `p."deletedHeight" IS NULL`,
      `p."isOnline" = true`,
      `ps."availableCPU" >= :totalCpu`,
      `ps."availableMemory" >= :totalMemory`,
      `ps."availableEphemeralStorage" >= :totalEphemeralStorage`
    ];

    if (agg.totalGpu > 0) {
      replacements.totalGpu = agg.totalGpu;
      wheres.push(`ps."availableGPU" >= :totalGpu`);
    }

    if (agg.hasPersistentStorage) {
      replacements.totalPersistentStorage = agg.totalPersistentStorage;
      wheres.push(`ps."availablePersistentStorage" >= :totalPersistentStorage`);
    }

    if (agg.totalGpu > 0 && agg.hasGpuAttributes) {
      joins.push(`INNER JOIN "providerSnapshotNode" psn ON psn."snapshotId" = ps.id`);
      joins.push(`INNER JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = psn.id`);

      replacements.gpuVendor = agg.gpuVendor;
      wheres.push(`gpu.vendor = :gpuVendor`);

      if (agg.gpuModel) {
        replacements.gpuModel = agg.gpuModel;
        wheres.push(`gpu.name = :gpuModel`);
      }
      if (agg.gpuInterface) {
        replacements.gpuInterface = agg.gpuInterface;
        wheres.push(`gpu.interface = :gpuInterface`);
      }
      if (agg.gpuMemorySize) {
        replacements.gpuMemorySize = agg.gpuMemorySize;
        wheres.push(`gpu."memorySize" = :gpuMemorySize`);
      }

      replacements.perNodeGpu = agg.maxPerReplicaGpu;
      wheres.push(`(psn."gpuAllocatable" - psn."gpuAllocated") >= :perNodeGpu`);
    }

    if (agg.hasPersistentStorage && agg.persistentStorageClass) {
      replacements.storageClass = agg.persistentStorageClass;
      joins.push(`INNER JOIN "providerSnapshotStorage" pss ON pss."snapshotId" = ps.id`);
      wheres.push(`pss.class = :storageClass`);
      wheres.push(`(pss.allocatable - pss.allocated) >= :totalPersistentStorage`);
    }

    const havingClauses: string[] = [];

    if (requirements.attributes.length > 0) {
      joins.push(`INNER JOIN "providerAttribute" pa ON pa.provider = p.owner`);
      requirements.attributes.forEach((attr, i) => {
        replacements[`attrKey${i}`] = attr.key;
        replacements[`attrVal${i}`] = attr.value;
        havingClauses.push(`COUNT(*) FILTER (WHERE pa."key" = :attrKey${i} AND pa."value" = :attrVal${i}) > 0`);
      });
    }

    if (requirements.signedBy.anyOf.length > 0 || requirements.signedBy.allOf.length > 0) {
      joins.push(`INNER JOIN "providerAttributeSignature" pas ON pas.provider = p.owner`);

      if (requirements.signedBy.anyOf.length > 0) {
        replacements.anyOfAuditors = requirements.signedBy.anyOf;
        wheres.push(`pas.auditor IN (:anyOfAuditors)`);
      }

      requirements.signedBy.allOf.forEach((auditor, i) => {
        replacements[`allOfAuditor${i}`] = auditor;
        havingClauses.push(`COUNT(*) FILTER (WHERE pas.auditor = :allOfAuditor${i}) > 0`);
      });
    }

    const havingClause = havingClauses.length > 0 ? `HAVING ${havingClauses.join(" AND ")}` : "";

    const groupByColumns = [
      `p.owner`,
      `p."hostUri"`,
      `ps."leaseCount"`,
      `ps."availableCPU"`,
      `ps."availableMemory"`,
      `ps."availableGPU"`,
      `ps."availableEphemeralStorage"`,
      `ps."availablePersistentStorage"`
    ].join(", ");

    if (isCount) {
      const sql = `
        SELECT COUNT(*) AS total FROM (
          SELECT p.owner
          FROM provider p
          ${joins.join("\n")}
          WHERE ${wheres.join("\n      AND ")}
          GROUP BY ${groupByColumns}
          ${havingClause}
        ) sub
      `;
      return { sql, replacements };
    }

    replacements.limit = limit;
    const sql = `
      SELECT
        p.owner,
        p."hostUri",
        COALESCE(ps."leaseCount", 0) AS "leaseCount",
        ps."availableCPU" AS "availableCpu",
        ps."availableMemory" AS "availableMemory",
        ps."availableGPU" AS "availableGpu",
        ps."availableEphemeralStorage" AS "availableEphemeralStorage",
        ps."availablePersistentStorage" AS "availablePersistentStorage"
      FROM provider p
      ${joins.join("\n")}
      WHERE ${wheres.join("\n      AND ")}
      GROUP BY ${groupByColumns}
      ${havingClause}
      ORDER BY COALESCE(ps."leaseCount", 0) DESC,
        ps."availableCPU" DESC
      LIMIT :limit
    `;
    return { sql, replacements };
  }

  async diagnoseConstraints(agg: AggregatedResources, requirements: BidScreeningRequest["data"]["requirements"]): Promise<Constraint[]> {
    const checks: { name: string; sql: string; replacements: Record<string, unknown>; feedback: string }[] = [
      {
        name: "Online providers (baseline)",
        sql: `SELECT COUNT(*) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true`,
        replacements: {},
        feedback: ""
      },
      {
        name: "CPU available",
        sql: `SELECT COUNT(*) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND ps."availableCPU" >= :totalCpu`,
        replacements: { totalCpu: agg.totalCpu },
        feedback: `Reduce CPU — exceeds most providers' available capacity`
      },
      {
        name: "Memory available",
        sql: `SELECT COUNT(*) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND ps."availableMemory" >= :totalMemory`,
        replacements: { totalMemory: agg.totalMemory },
        feedback: `Reduce memory — exceeds most providers' available memory`
      },
      {
        name: "Ephemeral storage available",
        sql: `SELECT COUNT(*) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND ps."availableEphemeralStorage" >= :totalEphemeralStorage`,
        replacements: { totalEphemeralStorage: agg.totalEphemeralStorage },
        feedback: `Reduce ephemeral storage — exceeds most providers' available storage`
      }
    ];

    if (agg.totalGpu > 0) {
      checks.push({
        name: "GPU count available",
        sql: `SELECT COUNT(*) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND ps."availableGPU" >= :totalGpu`,
        replacements: { totalGpu: agg.totalGpu },
        feedback: `Reduce GPU count or replica count`
      });
    }

    if (agg.totalGpu > 0 && agg.hasGpuAttributes) {
      const gpuReplacements: Record<string, unknown> = { gpuVendor: agg.gpuVendor };
      let gpuWhere = `gpu.vendor = :gpuVendor`;
      let modelDesc = agg.gpuVendor!;

      if (agg.gpuModel) {
        gpuReplacements.gpuModel = agg.gpuModel;
        gpuWhere += ` AND gpu.name = :gpuModel`;
        modelDesc += `/${agg.gpuModel}`;
      }

      checks.push({
        name: `GPU model (${modelDesc})`,
        sql: `SELECT COUNT(DISTINCT p.owner) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          INNER JOIN "providerSnapshotNode" psn ON psn."snapshotId" = ps.id
          INNER JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = psn.id
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND (psn."gpuAllocatable" - psn."gpuAllocated") > 0
            AND ${gpuWhere}`,
        replacements: gpuReplacements,
        feedback: `No providers have ${modelDesc} GPUs available — try a different model`
      });

      checks.push({
        name: `GPU per-node (${agg.maxPerReplicaGpu}x ${modelDesc})`,
        sql: `SELECT COUNT(DISTINCT p.owner) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          INNER JOIN "providerSnapshotNode" psn ON psn."snapshotId" = ps.id
          INNER JOIN "providerSnapshotNodeGPU" gpu ON gpu."snapshotNodeId" = psn.id
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND ${gpuWhere}
            AND (psn."gpuAllocatable" - psn."gpuAllocated") >= :perNodeGpu`,
        replacements: { ...gpuReplacements, perNodeGpu: agg.maxPerReplicaGpu },
        feedback: `No single node has ${agg.maxPerReplicaGpu}x ${modelDesc} GPUs free — reduce GPU count per replica`
      });
    }

    if (agg.hasPersistentStorage) {
      const storageReplacements: Record<string, unknown> = { totalPersistentStorage: agg.totalPersistentStorage };
      let storageWhere = `(pss.allocatable - pss.allocated) >= :totalPersistentStorage`;

      if (agg.persistentStorageClass) {
        storageReplacements.storageClass = agg.persistentStorageClass;
        storageWhere += ` AND pss.class = :storageClass`;
      }

      checks.push({
        name: `Persistent storage`,
        sql: `SELECT COUNT(DISTINCT p.owner) AS c FROM provider p
          INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"
          INNER JOIN "providerSnapshotStorage" pss ON pss."snapshotId" = ps.id
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND ${storageWhere}`,
        replacements: storageReplacements,
        feedback: `Reduce persistent storage or try a different class (beta3/nvme has the most providers)`
      });
    }

    if (requirements.attributes.length > 0) {
      for (const attr of requirements.attributes) {
        checks.push({
          name: `Attribute ${attr.key}=${attr.value}`,
          sql: `SELECT COUNT(DISTINCT p.owner) AS c FROM provider p
            INNER JOIN "providerAttribute" pa ON pa.provider = p.owner
            WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
              AND pa."key" = :key AND pa."value" = :value`,
          replacements: { key: attr.key, value: attr.value },
          feedback: `No providers have attribute ${attr.key}=${attr.value}`
        });
      }
    }

    if (requirements.signedBy.anyOf.length > 0) {
      checks.push({
        name: "Auditor signature (anyOf)",
        sql: `SELECT COUNT(DISTINCT p.owner) AS c FROM provider p
          INNER JOIN "providerAttributeSignature" pas ON pas.provider = p.owner
          WHERE p."deletedHeight" IS NULL AND p."isOnline" = true
            AND pas.auditor IN (:auditors)`,
        replacements: { auditors: requirements.signedBy.anyOf },
        feedback: `Few providers are signed by the required auditor(s)`
      });
    }

    const [baselineRow] = await this.#chainDb.query<ConstraintCheckRow>(checks[0].sql, {
      replacements: checks[0].replacements,
      type: QueryTypes.SELECT
    });
    const baselineCount = Number(baselineRow.c);

    if (baselineCount === 0) {
      return [{ name: checks[0].name, count: 0, actionableFeedback: "No providers are currently online" }];
    }

    const remaining = await Promise.all(
      checks.slice(1).map(async check => {
        const [row] = await this.#chainDb.query<ConstraintCheckRow>(check.sql, {
          replacements: check.replacements,
          type: QueryTypes.SELECT
        });
        return { name: check.name, count: Number(row.c), actionableFeedback: check.feedback };
      })
    );

    return [{ name: checks[0].name, count: baselineCount, actionableFeedback: checks[0].feedback }, ...remaining];
  }
}
