import { getTableName } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { type Database, PG_CLIENT } from "@src/providers/postgres.provider";

const TABLE = getTableName(providerInventory);

export interface AvailableGpu {
  vendor: string;
  model: string;
  memory: string;
  interface: string;
}

/** A node reporting -1 allocatable GPUs declares unlimited capacity, mirroring `availableCapacity`. */
const UNLIMITED_CAPACITY = -1;

@singleton()
export class PlacementOptionsRepository {
  readonly #sql: Database;

  constructor(@inject(PG_CLIENT) sql: Database) {
    this.#sql = sql;
  }

  async findOnlineRegions(): Promise<string[]> {
    const sql = this.#sql;
    const rows = await sql<Array<{ region: string | null }>>`
      SELECT DISTINCT COALESCE(
        (SELECT a->>'value' FROM jsonb_array_elements(${sql(providerInventory.signedAttributes.name)}) AS a WHERE a->>'key' = 'location-region' LIMIT 1),
        (SELECT a->>'value' FROM jsonb_array_elements(${sql(providerInventory.selfAttributes.name)}) AS a WHERE a->>'key' = 'location-region' LIMIT 1)
      ) AS region
      FROM ${sql(TABLE)}
      WHERE ${sql(providerInventory.isOnline.name)} = true
        AND ${sql(providerInventory.isOnlineSince.name)} IS NOT NULL
    `;

    return rows
      .map(row => row.region)
      .filter((region): region is string => !!region)
      .sort();
  }

  /** Filtered on a node's free GPU capacity rather than on which of its GPUs are free, because the inventory does not say which units are free. */
  async findAvailableGpus(): Promise<AvailableGpu[]> {
    const sql = this.#sql;
    return await sql<AvailableGpu[]>`
      WITH gpu_nodes AS (
        SELECT
          node -> 'gpu' -> 'quantity' AS quantity,
          node -> 'gpu' -> 'info' AS info
        FROM ${sql(TABLE)}
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(${sql(providerInventory.inventory.name)} -> 'nodes') = 'array' THEN ${sql(providerInventory.inventory.name)} -> 'nodes' ELSE '[]'::jsonb END
        ) AS node
        WHERE ${sql(providerInventory.isOnline.name)} = true
          AND ${sql(providerInventory.isOnlineSince.name)} IS NOT NULL
          AND ${sql(providerInventory.maxNodeFreeGpu.name)} > 0
      ),
      free_gpu_nodes AS (
        SELECT info
        FROM gpu_nodes
        WHERE jsonb_typeof(quantity -> 'allocatable') = 'number'
          AND (
            (quantity ->> 'allocatable')::numeric = ${UNLIMITED_CAPACITY}
            OR (quantity ->> 'allocatable')::numeric > CASE WHEN jsonb_typeof(quantity -> 'allocated') = 'number' THEN (quantity ->> 'allocated')::numeric ELSE 0 END
          )
      )
      SELECT DISTINCT
        gpu ->> 'vendor' AS vendor,
        gpu ->> 'name' AS model,
        COALESCE(gpu ->> 'memorySize', '') AS memory,
        COALESCE(gpu ->> 'interface', '') AS "interface"
      FROM free_gpu_nodes
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(info) = 'array' THEN info ELSE '[]'::jsonb END
      ) AS gpu
      WHERE COALESCE(gpu ->> 'vendor', '') <> ''
        AND COALESCE(gpu ->> 'name', '') <> ''
      ORDER BY vendor, model, memory, "interface"
    `;
  }
}
