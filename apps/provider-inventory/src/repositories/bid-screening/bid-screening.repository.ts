import { getTableName } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { type Database, PG_CLIENT } from "@src/providers/postgres.provider";
import type { ClusterState, RequestedResourceUnit } from "@src/types/inventory";
import { aggregateCriteria, type BidScreeningCriteria, type PlacementRequirements } from "./bid-screening.aggregator";
// TODO(Issue 5): move auditor allowlist into configuration and accept it as a request input.
export const AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

export interface BidScreeningCandidate {
  owner: string;
  hostUri: string;
  cluster?: ClusterState;
  isAudited: boolean;
  createdAt: string;
  updatedAt: string;
  location: string | null;
  organization: string | null;
}

const TABLE = getTableName(providerInventory);

@singleton()
export class BidScreeningRepository {
  readonly #sql: Database;
  /**
   * Cache for provider inventory to avoid fetching and parsing its JSONB inventory and event loop overhead.
   */
  readonly #providersInventory = new Map<string, BidScreeningCandidate>();

  constructor(@inject(PG_CLIENT) sql: Database) {
    this.#sql = sql;
  }

  async findCandidates(resourceUnits: RequestedResourceUnit[], requirements: PlacementRequirements): Promise<BidScreeningCandidate[]> {
    const sql = this.#sql;
    const criteria = aggregateCriteria(resourceUnits, requirements);
    const where = this.#buildWhere(criteria);

    const rows = await sql<Array<{ owner: string; updatedAt: string }>>`
      SELECT
        ${sql(providerInventory.owner.name)} AS owner,
        to_char(${sql(providerInventory.updatedAt.name)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
      FROM ${sql(TABLE)}
      WHERE ${where}
    `;

    const missingFinalCandidatesIndexes = new Map<string, number>();
    const ownersToFetch: string[] = [];
    const finalCandidates: BidScreeningCandidate[] = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cache = this.#providersInventory.get(row.owner);
      if (!cache || cache.updatedAt !== row.updatedAt) {
        ownersToFetch.push(row.owner);
        missingFinalCandidatesIndexes.set(row.owner, i);
      } else {
        finalCandidates[i] = cache;
      }
    }

    if (ownersToFetch.length > 0) {
      const candidates = await sql<BidScreeningCandidate[]>`
        SELECT
          ${sql(providerInventory.owner.name)} AS owner,
          to_char(${sql(providerInventory.updatedAt.name)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt",
          to_char(${sql(providerInventory.createdAt.name)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
          ${sql(providerInventory.hostUri.name)} AS "hostUri",
          ${sql(providerInventory.inventory.name)} AS cluster,
          ${sql(providerInventory.auditedBy.name)} @> ARRAY[${AUDITOR}]::text[] AS "isAudited",
          COALESCE(
            (SELECT sa->>'value' FROM jsonb_array_elements(${sql(providerInventory.signedAttributes.name)}) AS sa WHERE sa->>'key' = 'location-region' LIMIT 1),
            (SELECT sa->>'value' FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS sa WHERE sa->>'key' = 'location-region' LIMIT 1)
          ) AS location,
          COALESCE(
            (SELECT sa->>'value' FROM jsonb_array_elements(${sql(providerInventory.signedAttributes.name)}) AS sa WHERE sa->>'key' = 'organization' LIMIT 1),
            (SELECT sa->>'value' FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS sa WHERE sa->>'key' = 'organization' LIMIT 1)
          ) AS organization
        FROM ${sql(TABLE)}
        WHERE ${sql(providerInventory.owner.name)} = ANY(${ownersToFetch}::text[])
      `;
      for (const candidate of candidates) {
        this.#providersInventory.set(candidate.owner, candidate);
        const index = missingFinalCandidatesIndexes.get(candidate.owner);
        if (index !== undefined) {
          finalCandidates[index] = candidate;
        }
      }
    }

    return finalCandidates;
  }

  #buildWhere(criteria: BidScreeningCriteria) {
    const sql = this.#sql;
    const AND = sql`AND`;
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
        AND ${sql(providerInventory.maxNodeFreeGpu.name)} >= ${criteria.maxPerReplicaGpu}
        AND ${sql(providerInventory.totalAvailableLeasedIp.name)} >= ${criteria.totalLeasedIps}`
    ];

    if (criteria.reclamationWindow !== undefined) {
      conditions.push(AND, sql`${sql(providerInventory.reclamationWindow.name)} >= ${criteria.reclamationWindow}`);
    }

    for (const unit of criteria.units) {
      if (unit.gpuTokens.length > 0) {
        conditions.push(AND, sql`${sql(providerInventory.gpuModels.name)} && ${unit.gpuTokens}::text[]`);
      }

      if (unit.persistentClasses.length > 0) {
        conditions.push(AND, sql`${sql(providerInventory.storageClasses.name)} @> ${unit.persistentClasses}::text[]`);
      }
    }

    if (criteria.attributes.length > 0) {
      conditions.push(AND, sql`${sql(providerInventory.selfAttributes.name)} @> ${sql.json(criteria.attributes)}::jsonb`);
    }

    for (const glob of criteria.globAttributes) {
      conditions.push(
        AND,
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS sa WHERE sa->>'key' ~* ${glob.keyPattern} AND sa->>'value' = ${glob.value})`
      );
    }

    if (criteria.signedBy.allOf.length > 0) {
      conditions.push(AND, sql`${sql(providerInventory.auditedBy.name)} @> ${criteria.signedBy.allOf}::text[]`);
    }
    if (criteria.signedBy.anyOf.length > 0) {
      conditions.push(AND, sql`${sql(providerInventory.auditedBy.name)} && ${criteria.signedBy.anyOf}::text[]`);
    }

    return conditions;
  }
}
