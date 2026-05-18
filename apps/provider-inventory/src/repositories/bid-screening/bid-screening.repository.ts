import { and, arrayContains, arrayOverlaps, eq, gte, isNotNull, type SQL, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { hydrateClusterState } from "@src/lib/hydrate-cluster-state/hydrate-cluster-state";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { RequestedResourceUnit } from "@src/types/inventory.types";
import type { ProviderWithClusterState } from "@src/types/provider";
import { aggregateCriteria, type BidScreeningCriteria } from "./bid-screening.aggregator";

// TODO(Issue 5): move auditor allowlist into configuration and accept it as a request input.
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

export type BidScreeningCandidate = ProviderWithClusterState & { isAudited: boolean };

@singleton()
export class BidScreeningRepository {
  readonly #db: PostgresJsDatabase;

  constructor(@inject(DRIZZLE_DB) db: PostgresJsDatabase) {
    this.#db = db;
  }

  async findCandidates(resourceUnits: RequestedResourceUnit[], requirements: GroupSpecJSON["requirements"]): Promise<BidScreeningCandidate[]> {
    const criteria = aggregateCriteria(resourceUnits, requirements);
    const where = and(...this.#buildWhere(criteria));

    const rows = await this.#db
      .select({
        owner: providerInventory.owner,
        hostUri: providerInventory.hostUri,
        ipRegion: providerInventory.ipRegion,
        uptime7d: providerInventory.uptime7d,
        inventory: providerInventory.inventory,
        isAudited: sql<boolean>`${providerInventory.auditedBy} @> ARRAY[${AUDITOR}]::text[]`.as("isAudited")
      })
      .from(providerInventory)
      .where(where);

    return rows.map(row => ({
      owner: row.owner,
      hostUri: row.hostUri,
      ipRegion: row.ipRegion,
      uptime7d: row.uptime7d,
      cluster: hydrateClusterState(row.inventory),
      isAudited: row.isAudited
    }));
  }

  #buildWhere(criteria: BidScreeningCriteria): SQL[] {
    /**
     * Ensure that total* are enough to cover resource request (may have false positives),
     * and that the largest service can be placed on at least one node (prevents false positives due to fragmentation).
     */
    const conditions: SQL[] = [
      eq(providerInventory.isOnline, true),
      isNotNull(providerInventory.isOnlineSince),
      gte(providerInventory.totalAvailableCpu, criteria.totalCpu),
      gte(providerInventory.totalAvailableMemory, criteria.totalMemory),
      gte(providerInventory.totalAvailableGpu, criteria.totalGpu),
      gte(providerInventory.totalAvailableEph, criteria.totalEphemeralStorage),
      gte(providerInventory.totalAvailablePersistent, criteria.totalPersistentStorage),
      gte(providerInventory.maxNodeFreeCpu, criteria.maxPerReplicaCpu),
      gte(providerInventory.maxNodeFreeMemory, criteria.maxPerReplicaMemory),
      gte(providerInventory.maxNodeFreeGpu, criteria.maxPerReplicaGpu)
    ];

    for (const unit of criteria.units) {
      if (unit.gpuTokens.length > 0) {
        conditions.push(arrayOverlaps(providerInventory.gpuModels, unit.gpuTokens));
      }

      if (unit.persistentClasses.length > 0) {
        conditions.push(arrayContains(providerInventory.storageClasses, unit.persistentClasses));
      }
    }

    if (criteria.attributes.length > 0) {
      conditions.push(sql`${providerInventory.selfAttributes} @> ${sql.param(criteria.attributes)}::jsonb`);
    }

    for (const glob of criteria.globAttributes) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${providerInventory.selfAttributes}) AS sa WHERE sa->>'key' ~* ${glob.keyPattern} AND sa->>'value' = ${glob.value})`
      );
    }

    if (criteria.signedBy.allOf.length > 0) {
      conditions.push(arrayContains(providerInventory.auditedBy, criteria.signedBy.allOf));
    }
    if (criteria.signedBy.anyOf.length > 0) {
      conditions.push(arrayOverlaps(providerInventory.auditedBy, criteria.signedBy.anyOf));
    }

    return conditions;
  }
}
