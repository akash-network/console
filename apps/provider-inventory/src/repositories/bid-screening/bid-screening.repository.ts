import { getTableName } from "drizzle-orm";
import type postgres from "postgres";
import { inject, singleton } from "tsyringe";

import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { type Database, PG_CLIENT } from "@src/providers/postgres.provider";
import type { RequestedResourceUnit } from "@src/types/inventory.types";
import type { ProviderWithClusterState } from "@src/types/provider";
import { aggregateCriteria, type BidScreeningCriteria } from "./bid-screening.aggregator";
// TODO(Issue 5): move auditor allowlist into configuration and accept it as a request input.
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

export type BidScreeningCandidate = ProviderWithClusterState & { isAudited: boolean };

const TABLE = getTableName(providerInventory);

@singleton()
export class BidScreeningRepository {
  readonly #sql: Database;

  constructor(@inject(PG_CLIENT) sql: Database) {
    this.#sql = sql;
  }

  async findCandidates(resourceUnits: RequestedResourceUnit[], requirements: GroupSpecJSON["requirements"]): Promise<BidScreeningCandidate[]> {
    const sql = this.#sql;
    const criteria = aggregateCriteria(resourceUnits, requirements);
    const where = this.#joinAnd(this.#buildWhere(criteria));

    const rows = await sql<BidScreeningCandidate[]>`
      SELECT
        ${sql(providerInventory.owner.name)} AS owner,
        ${sql(providerInventory.hostUri.name)} AS "hostUri",
        ${sql(providerInventory.inventory.name)} AS cluster,
        ${sql(providerInventory.auditedBy.name)} @> ARRAY[${AUDITOR}]::text[] AS "isAudited"
      FROM ${sql(TABLE)}
      WHERE ${where}
    `;

    return [...rows];
  }

  #buildWhere(criteria: BidScreeningCriteria) {
    const sql = this.#sql;
    /**
     * Ensure that total* are enough to cover resource request (may have false positives),
     * and that the largest service can be placed on at least one node (prevents false positives due to fragmentation).
     */
    const conditions = [
      sql`${sql(providerInventory.isOnline.name)} = true
        AND ${sql(providerInventory.isOnlineSince.name)} IS NOT NULL
        AND ${sql(providerInventory.totalAvailableCpu.name)} >= ${criteria.totalCpu}
        AND ${sql(providerInventory.totalAvailableMemory.name)} >= ${criteria.totalMemory}
        AND ${sql(providerInventory.totalAvailableGpu.name)} >= ${criteria.totalGpu}
        AND ${sql(providerInventory.totalAvailableEph.name)} >= ${criteria.totalEphemeralStorage}
        AND ${sql(providerInventory.totalAvailablePersistent.name)} >= ${criteria.totalPersistentStorage}
        AND ${sql(providerInventory.maxNodeFreeCpu.name)} >= ${criteria.maxPerReplicaCpu}
        AND ${sql(providerInventory.maxNodeFreeMemory.name)} >= ${criteria.maxPerReplicaMemory}
        AND ${sql(providerInventory.maxNodeFreeGpu.name)} >= ${criteria.maxPerReplicaGpu}`
    ];

    for (const unit of criteria.units) {
      if (unit.gpuTokens.length > 0) {
        conditions.push(sql`${sql(providerInventory.gpuModels.name)} && ${unit.gpuTokens}::text[]`);
      }

      if (unit.persistentClasses.length > 0) {
        conditions.push(sql`${sql(providerInventory.storageClasses.name)} @> ${unit.persistentClasses}::text[]`);
      }
    }

    if (criteria.attributes.length > 0) {
      conditions.push(sql`${sql(providerInventory.selfAttributes.name)} @> ${sql.json(criteria.attributes)}::jsonb`);
    }

    for (const glob of criteria.globAttributes) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS sa WHERE sa->>'key' ~* ${glob.keyPattern} AND sa->>'value' = ${glob.value})`
      );
    }

    if (criteria.signedBy.allOf.length > 0) {
      conditions.push(sql`${sql(providerInventory.auditedBy.name)} @> ${criteria.signedBy.allOf}::text[]`);
    }
    if (criteria.signedBy.anyOf.length > 0) {
      conditions.push(sql`${sql(providerInventory.auditedBy.name)} && ${criteria.signedBy.anyOf}::text[]`);
    }

    return conditions;
  }

  #joinAnd(conditions: SqlFragment[]): SqlFragment {
    const sql = this.#sql;
    return conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
  }
}

type SqlFragment = postgres.PendingQuery<postgres.Row[]>;
