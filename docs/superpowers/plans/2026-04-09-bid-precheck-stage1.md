# Bid Precheck Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `POST /v1/bid-precheck` API endpoint that filters providers from the indexer database by resource capacity, GPU model, storage class, attributes, and auditor signatures — returning ranked candidates for Stage 2 provider-side bid screening.

**Architecture:** New service in the provider feature module (`apps/api/src/provider/`) using raw SQL via the existing `CHAIN_DB` Sequelize connection. Follows the same route → controller → service pattern as other provider endpoints. The service builds dynamic SQL with conditional JOINs/WHERE/HAVING clauses based on the input GroupSpec.

**Tech Stack:** Hono + @hono/zod-openapi, Zod schemas, tsyringe DI, Sequelize raw queries, Vitest + vitest-mock-extended

**Spec:** `docs/superpowers/specs/2026-04-09-bid-precheck-stage1-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/provider/http-schemas/bid-precheck.schema.ts` | Zod request/response schemas |
| Create | `src/provider/services/bid-precheck/bid-precheck.service.ts` | SQL query builder + executor |
| Create | `src/provider/services/bid-precheck/bid-precheck.service.spec.ts` | Unit tests |
| Create | `src/provider/controllers/bid-precheck/bid-precheck.controller.ts` | Thin controller |
| Create | `src/provider/routes/bid-precheck/bid-precheck.router.ts` | POST route definition |
| Modify | `src/provider/routes/index.ts` | Export new router |
| Modify | `src/provider/index.ts` | Re-export (if needed) |
| Modify | `src/rest-app.ts` | Register router in openApiHonoHandlers |

All paths below are relative to `apps/api/`.

---

### Task 1: Create branch

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/provider-bid-precheck-stage1 main
```

- [ ] **Step 2: Commit the spec and plan docs**

```bash
git add docs/superpowers/specs/2026-04-09-bid-precheck-stage1-design.md docs/superpowers/plans/2026-04-09-bid-precheck-stage1.md
git commit -m "docs(provider): add bid precheck stage 1 spec and plan (CON-187)"
```

---

### Task 2: Zod request/response schemas

**Files:**
- Create: `src/provider/http-schemas/bid-precheck.schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { z } from "zod";

const GpuAttributesSchema = z.object({
  vendor: z.string(),
  model: z.string().optional(),
  interface: z.string().optional(),
  memorySize: z.string().optional()
});

const ResourceUnitSchema = z
  .object({
    cpu: z.number().int().positive(),
    memory: z.number().int().positive(),
    gpu: z.number().int().min(0),
    gpuAttributes: GpuAttributesSchema.optional(),
    ephemeralStorage: z.number().int().positive(),
    persistentStorage: z.number().int().positive().optional(),
    persistentStorageClass: z.enum(["beta1", "beta2", "beta3"]).optional(),
    count: z.number().int().positive()
  })
  .refine(data => data.gpu === 0 || data.gpuAttributes !== undefined, {
    message: "gpuAttributes is required when gpu > 0",
    path: ["gpuAttributes"]
  });

const PlacementRequirementsSchema = z.object({
  attributes: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  signedBy: z
    .object({
      allOf: z.array(z.string()).default([]),
      anyOf: z.array(z.string()).default([])
    })
    .default({})
});

export const BidPrecheckRequestSchema = z.object({
  data: z.object({
    resources: z.array(ResourceUnitSchema).min(1),
    requirements: PlacementRequirementsSchema.default({}),
    limit: z.number().int().min(1).max(200).default(50)
  })
});

export type BidPrecheckRequest = z.infer<typeof BidPrecheckRequestSchema>;

const ProviderMatchSchema = z.object({
  owner: z.string(),
  hostUri: z.string(),
  leaseCount: z.number(),
  availableCpu: z.number(),
  availableMemory: z.number(),
  availableGpu: z.number(),
  availableEphemeralStorage: z.number(),
  availablePersistentStorage: z.number()
});

const ConstraintSchema = z.object({
  name: z.string(),
  count: z.number(),
  actionableFeedback: z.string()
});

export const BidPrecheckResponseSchema = z.object({
  data: z.object({
    providers: z.array(ProviderMatchSchema),
    total: z.number(),
    queryTimeMs: z.number(),
    constraints: z.array(ConstraintSchema).optional()
  })
});

export type BidPrecheckResponse = z.infer<typeof BidPrecheckResponseSchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors related to bid-precheck schema.

- [ ] **Step 3: Commit**

```bash
git add src/provider/http-schemas/bid-precheck.schema.ts
git commit -m "feat(provider): add bid precheck Zod request/response schemas"
```

---

### Task 3: Bid precheck service — query builder

**Files:**
- Create: `src/provider/services/bid-precheck/bid-precheck.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
import { QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import type { BidPrecheckRequest } from "@src/provider/http-schemas/bid-precheck.schema";

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

export interface BidPrecheckResult {
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
export class BidPrecheckService {
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  async findMatchingProviders(input: BidPrecheckRequest["data"]): Promise<BidPrecheckResult> {
    const agg = this.aggregateResources(input.resources);
    const limit = input.limit ?? 50;

    const start = performance.now();

    const { sql: countSql, replacements: countReplacements } = this.buildQuery(agg, input.requirements, undefined, true);
    const { sql: mainSql, replacements: mainReplacements } = this.buildQuery(agg, input.requirements, limit, false);

    const [[countRow], providers] = await Promise.all([
      this.#chainDb.query<{ total: string }>(countSql, { type: QueryTypes.SELECT, replacements: countReplacements }),
      this.#chainDb.query<ProviderMatchRow>(mainSql, { type: QueryTypes.SELECT, replacements: mainReplacements })
    ]);

    const queryTimeMs = Math.round((performance.now() - start) * 100) / 100;
    const total = Number(countRow?.total ?? 0);

    const result: BidPrecheckResult = { providers, total, queryTimeMs };

    if (total === 0) {
      result.constraints = await this.diagnoseConstraints(agg, input.requirements);
    }

    return result;
  }

  aggregateResources(resources: BidPrecheckRequest["data"]["resources"]): AggregatedResources {
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
    requirements: BidPrecheckRequest["data"]["requirements"],
    limit: number | undefined,
    isCount: boolean
  ): { sql: string; replacements: Record<string, unknown> } {
    const replacements: Record<string, unknown> = {
      totalCpu: agg.totalCpu,
      totalMemory: agg.totalMemory,
      totalEphemeralStorage: agg.totalEphemeralStorage
    };

    const joins: string[] = [
      `INNER JOIN "providerSnapshot" ps ON ps.id = p."lastSuccessfulSnapshotId"`
    ];

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

    // GPU model matching via node-level data
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

    // Persistent storage class matching
    if (agg.hasPersistentStorage && agg.persistentStorageClass) {
      replacements.storageClass = agg.persistentStorageClass;
      joins.push(`INNER JOIN "providerSnapshotStorage" pss ON pss."snapshotId" = ps.id`);
      wheres.push(`pss.class = :storageClass`);
      wheres.push(`(pss.allocatable - pss.allocated) >= :totalPersistentStorage`);
    }

    // Provider attribute matching
    const havingClauses: string[] = [];

    if (requirements.attributes.length > 0) {
      joins.push(`INNER JOIN "providerAttribute" pa ON pa.provider = p.owner`);
      requirements.attributes.forEach((attr, i) => {
        replacements[`attrKey${i}`] = attr.key;
        replacements[`attrVal${i}`] = attr.value;
        havingClauses.push(`COUNT(*) FILTER (WHERE pa."key" = :attrKey${i} AND pa."value" = :attrVal${i}) > 0`);
      });
    }

    // Auditor signature matching
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

  async diagnoseConstraints(
    agg: AggregatedResources,
    requirements: BidPrecheckRequest["data"]["requirements"]
  ): Promise<Constraint[]> {
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

    const results: Constraint[] = [];
    for (const check of checks) {
      const [row] = await this.#chainDb.query<ConstraintCheckRow>(check.sql, {
        replacements: check.replacements,
        type: QueryTypes.SELECT
      });
      results.push({
        name: check.name,
        count: Number(row.c),
        actionableFeedback: check.feedback
      });
    }

    return results;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/provider/services/bid-precheck/bid-precheck.service.ts
git commit -m "feat(provider): add bid precheck service with SQL query builder"
```

---

### Task 4: Bid precheck service — unit tests

**Files:**
- Create: `src/provider/services/bid-precheck/bid-precheck.service.spec.ts`

This task creates the full test suite. The tests mock the `CHAIN_DB` Sequelize instance and verify SQL generation + parameter binding. Uses the `setup()` pattern per project convention.

- [ ] **Step 1: Create the test file**

```typescript
import { QueryTypes } from "sequelize";
import type { Sequelize } from "sequelize";
import { mock } from "vitest-mock-extended";

import type { BidPrecheckRequest } from "@src/provider/http-schemas/bid-precheck.schema";
import { BidPrecheckService } from "./bid-precheck.service";

describe(BidPrecheckService.name, () => {
  describe("aggregateResources", () => {
    it("aggregates single resource unit correctly", () => {
      const { service } = setup();
      const result = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }
      ]);

      expect(result.totalCpu).toBe(1000);
      expect(result.totalMemory).toBe(1073741824);
      expect(result.totalGpu).toBe(0);
      expect(result.totalEphemeralStorage).toBe(1073741824);
      expect(result.totalPersistentStorage).toBe(0);
      expect(result.hasGpuAttributes).toBe(false);
      expect(result.hasPersistentStorage).toBe(false);
    });

    it("multiplies resources by replica count", () => {
      const { service } = setup();
      const result = service.aggregateResources([
        { cpu: 500, memory: 536870912, gpu: 0, ephemeralStorage: 1073741824, count: 10 }
      ]);

      expect(result.totalCpu).toBe(5000);
      expect(result.totalMemory).toBe(5368709120);
      expect(result.totalEphemeralStorage).toBe(10737418240);
    });

    it("sums across multiple resource units", () => {
      const { service } = setup();
      const result = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 2 },
        { cpu: 2000, memory: 2147483648, gpu: 0, ephemeralStorage: 2147483648, count: 3 }
      ]);

      expect(result.totalCpu).toBe(1000 * 2 + 2000 * 3);
      expect(result.totalMemory).toBe(1073741824 * 2 + 2147483648 * 3);
    });

    it("tracks GPU attributes and per-replica GPU count", () => {
      const { service } = setup();
      const result = service.aggregateResources([
        {
          cpu: 4000, memory: 17179869184, gpu: 2, ephemeralStorage: 107374182400, count: 3,
          gpuAttributes: { vendor: "nvidia", model: "a100" }
        }
      ]);

      expect(result.totalGpu).toBe(6);
      expect(result.maxPerReplicaGpu).toBe(2);
      expect(result.hasGpuAttributes).toBe(true);
      expect(result.gpuVendor).toBe("nvidia");
      expect(result.gpuModel).toBe("a100");
    });

    it("tracks persistent storage and class", () => {
      const { service } = setup();
      const result = service.aggregateResources([
        {
          cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1,
          persistentStorage: 10737418240, persistentStorageClass: "beta3"
        }
      ]);

      expect(result.hasPersistentStorage).toBe(true);
      expect(result.totalPersistentStorage).toBe(10737418240);
      expect(result.persistentStorageClass).toBe("beta3");
    });

    it("uses max per-replica GPU across resource units", () => {
      const { service } = setup();
      const result = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 1, ephemeralStorage: 1073741824, count: 2, gpuAttributes: { vendor: "nvidia" } },
        { cpu: 1000, memory: 1073741824, gpu: 4, ephemeralStorage: 1073741824, count: 1, gpuAttributes: { vendor: "nvidia" } }
      ]);

      expect(result.totalGpu).toBe(1 * 2 + 4 * 1);
      expect(result.maxPerReplicaGpu).toBe(4);
    });
  });

  describe("buildQuery", () => {
    it("builds minimal query for CPU-only workload", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }
      ]);
      const requirements = defaultRequirements();
      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain(`"availableCPU" >= :totalCpu`);
      expect(sql).toContain(`"availableMemory" >= :totalMemory`);
      expect(sql).toContain(`"availableEphemeralStorage" >= :totalEphemeralStorage`);
      expect(sql).not.toContain(`"providerSnapshotNodeGPU"`);
      expect(sql).not.toContain(`"providerSnapshotStorage" pss`);
      expect(sql).not.toContain(`"providerAttribute"`);
      expect(sql).not.toContain(`"providerAttributeSignature"`);
      expect(sql).toContain(`LIMIT :limit`);
      expect(replacements.totalCpu).toBe(1000);
      expect(replacements.limit).toBe(50);
    });

    it("includes GPU JOINs and filters for GPU workload", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 4000, memory: 17179869184, gpu: 1, ephemeralStorage: 107374182400, count: 1, gpuAttributes: { vendor: "nvidia", model: "a100" } }
      ]);
      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain(`"providerSnapshotNode" psn`);
      expect(sql).toContain(`"providerSnapshotNodeGPU" gpu`);
      expect(sql).toContain(`gpu.vendor = :gpuVendor`);
      expect(sql).toContain(`gpu.name = :gpuModel`);
      expect(sql).toContain(`(psn."gpuAllocatable" - psn."gpuAllocated") >= :perNodeGpu`);
      expect(replacements.gpuVendor).toBe("nvidia");
      expect(replacements.gpuModel).toBe("a100");
      expect(replacements.perNodeGpu).toBe(1);
    });

    it("includes GPU vendor-only filter when model is omitted", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 4000, memory: 17179869184, gpu: 1, ephemeralStorage: 107374182400, count: 1, gpuAttributes: { vendor: "nvidia" } }
      ]);
      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain(`gpu.vendor = :gpuVendor`);
      expect(sql).not.toContain(`gpu.name = :gpuModel`);
      expect(replacements.gpuVendor).toBe("nvidia");
      expect(replacements).not.toHaveProperty("gpuModel");
    });

    it("includes all GPU attributes when specified", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        {
          cpu: 4000, memory: 17179869184, gpu: 1, ephemeralStorage: 107374182400, count: 1,
          gpuAttributes: { vendor: "nvidia", model: "a100", interface: "PCIe", memorySize: "80Gi" }
        }
      ]);
      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain(`gpu.interface = :gpuInterface`);
      expect(sql).toContain(`gpu."memorySize" = :gpuMemorySize`);
      expect(replacements.gpuInterface).toBe("PCIe");
      expect(replacements.gpuMemorySize).toBe("80Gi");
    });

    it("includes persistent storage class filter", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1, persistentStorage: 10737418240, persistentStorageClass: "beta2" }
      ]);
      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain(`"providerSnapshotStorage" pss`);
      expect(sql).toContain(`pss.class = :storageClass`);
      expect(sql).toContain(`(pss.allocatable - pss.allocated) >= :totalPersistentStorage`);
      expect(replacements.storageClass).toBe("beta2");
    });

    it("includes persistent storage capacity without class filter when class omitted", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1, persistentStorage: 10737418240 }
      ]);
      const { sql } = service.buildQuery(agg, defaultRequirements(), 50, false);

      expect(sql).toContain(`"availablePersistentStorage" >= :totalPersistentStorage`);
      expect(sql).not.toContain(`"providerSnapshotStorage" pss`);
    });

    it("includes attribute HAVING clauses", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }
      ]);
      const requirements = {
        attributes: [
          { key: "region", value: "us-west" },
          { key: "organization", value: "overclock" }
        ],
        signedBy: { allOf: [], anyOf: [] }
      };
      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain(`"providerAttribute" pa`);
      expect(sql).toContain(`HAVING`);
      expect(sql).toContain(`pa."key" = :attrKey0 AND pa."value" = :attrVal0`);
      expect(sql).toContain(`pa."key" = :attrKey1 AND pa."value" = :attrVal1`);
      expect(replacements.attrKey0).toBe("region");
      expect(replacements.attrVal0).toBe("us-west");
      expect(replacements.attrKey1).toBe("organization");
      expect(replacements.attrVal1).toBe("overclock");
    });

    it("includes signedBy anyOf filter", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }
      ]);
      const requirements = {
        attributes: [],
        signedBy: { allOf: [], anyOf: ["akash1auditor1", "akash1auditor2"] }
      };
      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain(`"providerAttributeSignature" pas`);
      expect(sql).toContain(`pas.auditor IN (:anyOfAuditors)`);
      expect(replacements.anyOfAuditors).toEqual(["akash1auditor1", "akash1auditor2"]);
    });

    it("includes signedBy allOf HAVING clauses", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }
      ]);
      const requirements = {
        attributes: [],
        signedBy: { allOf: ["akash1auditorA", "akash1auditorB"], anyOf: [] }
      };
      const { sql, replacements } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain(`HAVING`);
      expect(sql).toContain(`pas.auditor = :allOfAuditor0`);
      expect(sql).toContain(`pas.auditor = :allOfAuditor1`);
      expect(replacements.allOfAuditor0).toBe("akash1auditorA");
      expect(replacements.allOfAuditor1).toBe("akash1auditorB");
    });

    it("builds count query wrapping the main query", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        { cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }
      ]);
      const { sql, replacements } = service.buildQuery(agg, defaultRequirements(), undefined, true);

      expect(sql).toContain(`SELECT COUNT(*) AS total FROM (`);
      expect(sql).not.toContain(`LIMIT`);
      expect(replacements).not.toHaveProperty("limit");
    });

    it("combines GPU + persistent storage + attributes + signedBy", () => {
      const { service } = setup();
      const agg = service.aggregateResources([
        {
          cpu: 4000, memory: 17179869184, gpu: 1, ephemeralStorage: 107374182400, count: 1,
          gpuAttributes: { vendor: "nvidia", model: "a100" },
          persistentStorage: 10737418240, persistentStorageClass: "beta3"
        }
      ]);
      const requirements = {
        attributes: [{ key: "region", value: "us-west" }],
        signedBy: { allOf: [], anyOf: ["akash1auditor1"] }
      };
      const { sql } = service.buildQuery(agg, requirements, 50, false);

      expect(sql).toContain(`"providerSnapshotNodeGPU" gpu`);
      expect(sql).toContain(`"providerSnapshotStorage" pss`);
      expect(sql).toContain(`"providerAttribute" pa`);
      expect(sql).toContain(`"providerAttributeSignature" pas`);
      expect(sql).toContain(`HAVING`);
    });
  });

  describe("findMatchingProviders", () => {
    it("returns providers and total count", async () => {
      const { service, chainDb } = setup();
      const mockProviders = [
        { owner: "akash1abc", hostUri: "https://p1.com", leaseCount: 10, availableCpu: 4000, availableMemory: 8589934592, availableGpu: 0, availableEphemeralStorage: 32212254720, availablePersistentStorage: 0 }
      ];

      chainDb.query
        .mockResolvedValueOnce([{ total: "5" }])
        .mockResolvedValueOnce(mockProviders);

      const result = await service.findMatchingProviders({
        resources: [{ cpu: 500, memory: 536870912, gpu: 0, ephemeralStorage: 1073741824, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      expect(result.providers).toEqual(mockProviders);
      expect(result.total).toBe(5);
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.constraints).toBeUndefined();
    });

    it("runs constraint diagnosis when total is 0", async () => {
      const { service, chainDb } = setup();

      // Count query returns 0
      chainDb.query
        .mockResolvedValueOnce([{ total: "0" }])
        .mockResolvedValueOnce([]);

      // Diagnosis queries: baseline, CPU, memory, ephemeral storage
      chainDb.query
        .mockResolvedValueOnce([{ c: "72" }])
        .mockResolvedValueOnce([{ c: "50" }])
        .mockResolvedValueOnce([{ c: "45" }])
        .mockResolvedValueOnce([{ c: "60" }]);

      const result = await service.findMatchingProviders({
        resources: [{ cpu: 256000, memory: 549755813888, gpu: 0, ephemeralStorage: 1099511627776, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      expect(result.total).toBe(0);
      expect(result.constraints).toBeDefined();
      expect(result.constraints!.length).toBe(4);
      expect(result.constraints![0].name).toBe("Online providers (baseline)");
    });

    it("does not run diagnosis when total > 0", async () => {
      const { service, chainDb } = setup();

      chainDb.query
        .mockResolvedValueOnce([{ total: "10" }])
        .mockResolvedValueOnce([{ owner: "akash1abc", hostUri: "https://p1.com", leaseCount: 5, availableCpu: 2000, availableMemory: 4294967296, availableGpu: 0, availableEphemeralStorage: 10737418240, availablePersistentStorage: 0 }]);

      const result = await service.findMatchingProviders({
        resources: [{ cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }],
        requirements: defaultRequirements(),
        limit: 50
      });

      expect(result.constraints).toBeUndefined();
      // Only 2 calls: count + main query
      expect(chainDb.query).toHaveBeenCalledTimes(2);
    });

    it("uses default limit of 50 when not specified", async () => {
      const { service, chainDb } = setup();

      chainDb.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([]);

      await service.findMatchingProviders({
        resources: [{ cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, count: 1 }],
        requirements: defaultRequirements()
      } as BidPrecheckRequest["data"]);

      const mainCall = chainDb.query.mock.calls[1];
      expect(mainCall[1]).toHaveProperty("replacements");
      expect((mainCall[1] as { replacements: Record<string, unknown> }).replacements.limit).toBe(50);
    });
  });

  function defaultRequirements(): BidPrecheckRequest["data"]["requirements"] {
    return { attributes: [], signedBy: { allOf: [], anyOf: [] } };
  }

  function setup() {
    const chainDb = mock<Sequelize>();
    const service = new BidPrecheckService(chainDb);
    return { service, chainDb };
  }
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/provider/services/bid-precheck/bid-precheck.service.spec.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/provider/services/bid-precheck/bid-precheck.service.spec.ts
git commit -m "test(provider): add bid precheck service unit tests"
```

---

### Task 5: Controller

**Files:**
- Create: `src/provider/controllers/bid-precheck/bid-precheck.controller.ts`

- [ ] **Step 1: Create the controller file**

```typescript
import { singleton } from "tsyringe";

import type { BidPrecheckRequest, BidPrecheckResponse } from "@src/provider/http-schemas/bid-precheck.schema";
import { BidPrecheckService } from "@src/provider/services/bid-precheck/bid-precheck.service";

@singleton()
export class BidPrecheckController {
  constructor(private readonly bidPrecheckService: BidPrecheckService) {}

  async precheck(input: BidPrecheckRequest["data"]): Promise<BidPrecheckResponse> {
    const result = await this.bidPrecheckService.findMatchingProviders(input);

    return {
      data: {
        providers: result.providers,
        total: result.total,
        queryTimeMs: result.queryTimeMs,
        constraints: result.constraints
      }
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/provider/controllers/bid-precheck/bid-precheck.controller.ts
git commit -m "feat(provider): add bid precheck controller"
```

---

### Task 6: Router and registration

**Files:**
- Create: `src/provider/routes/bid-precheck/bid-precheck.router.ts`
- Modify: `src/provider/routes/index.ts`
- Modify: `src/rest-app.ts`

- [ ] **Step 1: Create the router file**

```typescript
import { container } from "tsyringe";

import { BidPrecheckController } from "@src/provider/controllers/bid-precheck/bid-precheck.controller";
import { BidPrecheckRequestSchema, BidPrecheckResponseSchema } from "@src/provider/http-schemas/bid-precheck.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

export const bidPrecheckRouter = new OpenApiHonoHandler();

const postRoute = createRoute({
  method: "post",
  path: "/v1/bid-precheck",
  summary: "Pre-filter providers by resource capacity (Stage 1 bid screening)",
  tags: ["Providers"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: BidPrecheckRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Matching providers ranked by lease count and available resources",
      content: {
        "application/json": {
          schema: BidPrecheckResponseSchema
        }
      }
    }
  }
});

bidPrecheckRouter.openapi(postRoute, async function routeBidPrecheck(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(BidPrecheckController).precheck(data);
  return c.json(result, 200);
});
```

- [ ] **Step 2: Add export to provider routes index**

Add to `src/provider/routes/index.ts`:

```typescript
export * from "@src/provider/routes/bid-precheck/bid-precheck.router";
```

- [ ] **Step 3: Register router in rest-app.ts**

In `src/rest-app.ts`, add the import alongside other provider imports:

```typescript
import {
  auditorsRouter,
  bidPrecheckRouter,
  providerAttributesSchemaRouter,
  // ... rest of existing imports
} from "./provider";
```

Add `bidPrecheckRouter` to the `openApiHonoHandlers` array (after `providersRouter`):

```typescript
const openApiHonoHandlers: OpenApiHonoHandler[] = [
  // ... existing entries
  providersRouter,
  bidPrecheckRouter,
  auditorsRouter,
  // ... rest
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run all provider tests to ensure nothing is broken**

Run: `cd apps/api && npx vitest run src/provider/`
Expected: All tests pass.

- [ ] **Step 6: Run linting**

Run: `cd apps/api && npm run lint -- --quiet`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/provider/routes/bid-precheck/bid-precheck.router.ts src/provider/routes/index.ts src/rest-app.ts
git commit -m "feat(provider): add POST /v1/bid-precheck route and register in app"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start the API locally (or verify it builds)**

Run: `cd apps/api && npm run build`
Expected: Build succeeds.

- [ ] **Step 2: Test with curl (if running locally with DB access)**

```bash
curl -X POST http://localhost:3080/v1/bid-precheck \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "resources": [{
        "cpu": 1000,
        "memory": 1073741824,
        "gpu": 0,
        "ephemeralStorage": 1073741824,
        "count": 1
      }],
      "requirements": {
        "attributes": [],
        "signedBy": { "allOf": [], "anyOf": [] }
      }
    }
  }'
```

Expected: JSON response with `data.providers[]`, `data.total`, `data.queryTimeMs`.

- [ ] **Step 3: Final commit (if any lint/build fixes needed)**

```bash
git add -A
git commit -m "fix(provider): address lint/build issues in bid precheck"
```
