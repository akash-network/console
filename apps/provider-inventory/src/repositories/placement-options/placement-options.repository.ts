import { getTableName } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { type Database, PG_CLIENT } from "@src/providers/postgres.provider";
import { AUDITOR } from "@src/repositories/bid-screening/bid-screening.repository";

const TABLE = getTableName(providerInventory);

const GPU_CAPABILITY_PREFIX = "capabilities/gpu/";

export interface OnlineRegion {
  region: string;
  providerCount: number;
}

export interface AvailableGpu {
  owner: string;
  /** Position of the node in the provider's inventory, which tells its nodes apart. */
  node: number;
  vendor: string;
  model: string;
  memory: string;
  interface: string;
  /** Devices of exactly this kind the node reports, free or not. */
  units: number;
  /** GPUs the node has free across all of its devices, or null when it reports unlimited capacity. */
  nodeFreeUnits: number | null;
  /** The provider's advertised `capabilities/gpu/` keys with that prefix removed, which is how an SDL spells them. */
  advertisedGpuKeys: string[];
}

/** A node reporting -1 allocatable GPUs declares unlimited capacity, mirroring `availableCapacity`. */
const UNLIMITED_CAPACITY = -1;

@singleton()
export class PlacementOptionsRepository {
  readonly #sql: Database;

  constructor(@inject(PG_CLIENT) sql: Database) {
    this.#sql = sql;
  }

  /** Every managed deployment requires the Console auditor, which also has to have signed the region the provider declares for itself. */
  async findOnlineRegions(): Promise<OnlineRegion[]> {
    const sql = this.#sql;
    return await sql<OnlineRegion[]>`
      SELECT self.value AS region, COUNT(DISTINCT ${sql(providerInventory.owner.name)})::int AS "providerCount"
      FROM ${sql(TABLE)}
      CROSS JOIN LATERAL (
        SELECT a->>'value' AS value FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS a WHERE a->>'key' = 'location-region'
      ) AS self
      WHERE ${sql(providerInventory.isOnline.name)} = true
        AND ${sql(providerInventory.isOnlineSince.name)} IS NOT NULL
        AND ${sql(providerInventory.auditedBy.name)} @> ARRAY[${AUDITOR}]::text[]
        AND COALESCE(self.value, '') <> ''
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(${sql(providerInventory.signedAttributes.name)}) AS s
          WHERE s->>'auditor' = ${AUDITOR} AND s->>'key' = 'location-region' AND s->>'value' = self.value
        )
      GROUP BY self.value
      ORDER BY self.value
    `;
  }

  /** Filtered on a node's free GPU capacity rather than on which of its GPUs are free, because the inventory does not say which units are free. */
  async findAvailableGpus(): Promise<AvailableGpu[]> {
    const sql = this.#sql;
    return await sql<AvailableGpu[]>`
      WITH gpu_nodes AS (
        SELECT
          ${sql(providerInventory.owner.name)} AS owner,
          ARRAY(
            SELECT substr(a->>'key', ${GPU_CAPABILITY_PREFIX.length + 1}::int)
            FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS a
            WHERE starts_with(a->>'key', ${GPU_CAPABILITY_PREFIX}) AND a->>'value' = 'true'
            ORDER BY 1
          ) AS "advertisedGpuKeys",
          node.position::int AS node,
          node.value -> 'gpu' -> 'quantity' AS quantity,
          node.value -> 'gpu' -> 'info' AS info
        FROM ${sql(TABLE)}
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(${sql(providerInventory.inventory.name)} -> 'nodes') = 'array' THEN ${sql(providerInventory.inventory.name)} -> 'nodes' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS node(value, position)
        WHERE ${sql(providerInventory.isOnline.name)} = true
          AND ${sql(providerInventory.isOnlineSince.name)} IS NOT NULL
          AND ${sql(providerInventory.auditedBy.name)} @> ARRAY[${AUDITOR}]::text[]
          AND ${sql(providerInventory.maxNodeFreeGpu.name)} > 0
      ),
      gpu_node_capacity AS (
        SELECT
          owner,
          "advertisedGpuKeys",
          node,
          info,
          (quantity ->> 'allocatable')::numeric AS allocatable,
          CASE WHEN jsonb_typeof(quantity -> 'allocated') = 'number' THEN (quantity ->> 'allocated')::numeric ELSE 0 END AS allocated
        FROM gpu_nodes
        WHERE jsonb_typeof(quantity -> 'allocatable') = 'number'
      ),
      free_gpu_nodes AS (
        SELECT
          owner,
          "advertisedGpuKeys",
          node,
          info,
          CASE WHEN allocatable = ${UNLIMITED_CAPACITY} THEN NULL ELSE (allocatable - allocated)::int END AS "nodeFreeUnits"
        FROM gpu_node_capacity
        WHERE allocatable = ${UNLIMITED_CAPACITY} OR allocatable > allocated
      )
      SELECT
        owner,
        node,
        gpu ->> 'vendor' AS vendor,
        gpu ->> 'name' AS model,
        COALESCE(gpu ->> 'memorySize', '') AS memory,
        COALESCE(gpu ->> 'interface', '') AS "interface",
        COUNT(*)::int AS units,
        "nodeFreeUnits",
        "advertisedGpuKeys"
      FROM free_gpu_nodes
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(info) = 'array' THEN info ELSE '[]'::jsonb END
      ) AS gpu
      WHERE COALESCE(gpu ->> 'vendor', '') <> ''
        AND COALESCE(gpu ->> 'name', '') <> ''
      GROUP BY owner, node, "nodeFreeUnits", "advertisedGpuKeys", vendor, model, memory, "interface"
      ORDER BY vendor, model, memory, "interface", owner, node
    `;
  }
}
