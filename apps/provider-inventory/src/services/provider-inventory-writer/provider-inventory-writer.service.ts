import { createOtelLogger } from "@akashnetwork/logging/otel";
import { sql as rawSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";
import { inject, singleton } from "tsyringe";

import { providerInventory } from "@src/model-schemas/provider-inventory/provider-inventory.schema";
import { PG_CLIENT } from "@src/providers/postgres.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import type { ProjectedRow, ReducedAttributes } from "@src/types/inventory";

@singleton()
export class ProviderInventoryWriterService {
  private readonly logger = createOtelLogger({ context: "ProviderInventoryWriter" });
  private readonly db;

  constructor(@inject(PG_CLIENT) sql: postgres.Sql) {
    this.db = drizzle(sql);
  }

  async resetOnlineSince(): Promise<void> {
    await this.db.update(providerInventory).set({ isOnlineSince: null });
    this.logger.info({ event: "ONLINE_SINCE_RESET" });
  }

  async upsertProvider(owner: string, provider: ChainProvider, row: ProjectedRow, attributes: ReducedAttributes): Promise<void> {
    await this.db
      .insert(providerInventory)
      .values({
        owner,
        hostUri: provider.hostUri,
        createdHeight: provider.createdHeight,
        inventory: row.inventory,
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
        selfAttributes: attributes.selfAttributes,
        signedAttributes: attributes.signedAttributes,
        auditedBy: attributes.auditedBy,
        isOnline: true,
        isOnlineSince: rawSql`now()`,
        updatedAt: rawSql`now()`
      })
      .onConflictDoUpdate({
        target: providerInventory.owner,
        set: {
          hostUri: provider.hostUri,
          createdHeight: provider.createdHeight,
          inventory: row.inventory,
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
          selfAttributes: attributes.selfAttributes,
          signedAttributes: attributes.signedAttributes,
          auditedBy: attributes.auditedBy,
          isOnline: true,
          isOnlineSince: rawSql`now()`,
          updatedAt: rawSql`now()`
        }
      });

    this.logger.debug({ event: "PROVIDER_UPSERTED", owner });
  }
}
