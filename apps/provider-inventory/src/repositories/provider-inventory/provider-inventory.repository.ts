import type { LoggerService } from "@akashnetwork/logging";
import { and, arrayOverlaps, eq, sql as rawSql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { ResourcePair } from "@src/lib/resource-pair/resource-pair";
import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { DRIZZLE_DB } from "@src/providers/drizzle.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow } from "@src/types/inventory";
import type { ClusterState, NodeState } from "@src/types/inventory.types";
import type { ProviderWithClusterState } from "@src/types/provider";

@singleton()
export class ProviderInventoryRepository {
  readonly #logger: LoggerService;
  readonly #db: PostgresJsDatabase;

  constructor(@inject(DRIZZLE_DB) db: PostgresJsDatabase, @inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#db = db;
    this.#logger = loggerFactory({ context: "ProviderInventoryRepository" });
  }

  async resetOnlineSince(): Promise<void> {
    await this.#db.update(providerInventory).set({ isOnlineSince: null });
    this.#logger.info({ event: "ONLINE_SINCE_RESET" });
  }

  async deleteByOwner(owner: string): Promise<void> {
    await this.#db.delete(providerInventory).where(eq(providerInventory.owner, owner));
    this.#logger.info({ event: "PROVIDER_INVENTORY_DELETED", owner });
  }

  async markOffline(owner: string): Promise<void> {
    await this.#db
      .update(providerInventory)
      .set({ isOnline: false, isOnlineSince: null, updatedAt: rawSql`now()` })
      .where(eq(providerInventory.owner, owner));
    this.#logger.info({ event: "PROVIDER_MARKED_OFFLINE", owner });
  }

  async updateInventory(provider: ChainProvider, row: ProjectedRow): Promise<void> {
    await this.#db
      .update(providerInventory)
      .set({
        inventory: row.cluster,
        totalAvailableCpu: row.totalAvailableCpu,
        totalAvailableMemory: row.totalAvailableMemory,
        totalAvailableGpu: row.totalAvailableGpu,
        totalAvailableEph: row.totalAvailableEph,
        totalAvailablePersistent: row.totalAvailablePersistent,
        maxNodeFreeCpu: row.maxNodeFreeCpu,
        maxNodeFreeMemory: row.maxNodeFreeMemory,
        maxNodeFreeGpu: row.maxNodeFreeGpu,
        gpuModels: row.gpuModels,
        storageClasses: row.storageClasses,
        isOnline: true,
        isOnlineSince: rawSql`coalesce(${providerInventory.isOnlineSince}, now())`,
        updatedAt: rawSql`now()`
      })
      .where(eq(providerInventory.owner, provider.owner));

    this.#logger.debug({ event: "PROVIDER_INVENTORY_UPDATED", owner: provider.owner });
  }

  async upsertAttributes(provider: ChainProvider): Promise<void> {
    const auditedBy = [...new Set(provider.signedAttributes.map(a => a.auditor))].sort();
    const set = {
      hostUri: provider.hostUri,
      selfAttributes: provider.selfAttributes,
      signedAttributes: provider.signedAttributes,
      auditedBy,
      updatedAt: rawSql`now()`
    };

    await this.#db
      .insert(providerInventory)
      .values({ owner: provider.owner, ...set })
      .onConflictDoUpdate({ target: providerInventory.owner, set });

    this.#logger.debug({ event: "PROVIDER_ATTRIBUTES_UPSERTED", owner: provider.owner });
  }

  async getOnlineProviders(): Promise<ProviderWithClusterState[]> {
    const rows = await this.#db
      .select({
        owner: providerInventory.owner,
        hostUri: providerInventory.hostUri,
        ipRegion: providerInventory.ipRegion,
        uptime7d: providerInventory.uptime7d,
        inventory: providerInventory.inventory
      })
      .from(providerInventory)
      .where(and(eq(providerInventory.isOnline, true)));

    return rows.map(row => ({
      owner: row.owner,
      hostUri: row.hostUri,
      ipRegion: row.ipRegion,
      uptime7d: row.uptime7d,
      cluster: hydrateClusterState(row.inventory)
    }));
  }

  async getAuditedProviderAddresses(auditorAddresses: string[]): Promise<Set<string>> {
    if (auditorAddresses.length === 0) {
      return new Set();
    }

    const rows = await this.#db
      .select({ owner: providerInventory.owner })
      .from(providerInventory)
      .where(arrayOverlaps(providerInventory.auditedBy, auditorAddresses));

    return new Set(rows.map(r => r.owner));
  }
}

type RawPair = { allocatable: number | bigint; allocated: number | bigint };
type RawNode = Omit<NodeState, "cpu" | "memory" | "ephemeralStorage" | "gpu"> & {
  cpu: RawPair;
  memory: RawPair;
  ephemeralStorage: RawPair;
  gpu: { quantity: RawPair; info: NodeState["gpu"]["info"] };
};
type RawCluster = {
  nodes?: RawNode[];
  storage?: Record<string, { class: string; quantity: RawPair }>;
};

export function hydrateClusterState(raw: unknown): ClusterState {
  const cluster = (raw ?? {}) as RawCluster;
  const nodes = (cluster.nodes ?? []).map(hydrateNode);
  const storage: ClusterState["storage"] = Object.create(null);
  for (const [key, pool] of Object.entries(cluster.storage ?? {})) {
    storage[key] = { class: pool.class, quantity: hydratePair(pool.quantity) };
  }
  return { nodes, storage };
}

function hydrateNode(node: RawNode): NodeState {
  return {
    name: node.name,
    cpu: hydratePair(node.cpu),
    memory: hydratePair(node.memory),
    ephemeralStorage: hydratePair(node.ephemeralStorage),
    gpu: { quantity: hydratePair(node.gpu.quantity), info: node.gpu.info ?? [] },
    storageClasses: node.storageClasses ?? [],
    cpus: node.cpus ?? []
  };
}

function hydratePair(pair: RawPair): ResourcePair {
  const allocatable = typeof pair.allocatable === "bigint" ? pair.allocatable : BigInt(pair.allocatable || 0);
  const allocated = typeof pair.allocated === "bigint" ? pair.allocated : BigInt(pair.allocated || 0);

  return new ResourcePair(allocatable, allocated);
}
