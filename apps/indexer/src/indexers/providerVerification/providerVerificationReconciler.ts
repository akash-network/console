import { Block } from "@akashnetwork/database/dbSchemas";
import type { ProviderVerificationQueryClient } from "@akashnetwork/provider-verification";
import type { Transaction as DbTransaction } from "sequelize";

import type { ClaimedProviderVerificationTarget } from "./providerVerificationRepository";
import { ProviderVerificationRepository } from "./providerVerificationRepository";
import { mapProviderVerificationGlobalState, mapProviderVerificationProviderState } from "./providerVerificationStateMapper";

type VerificationQueryClient = Pick<ProviderVerificationQueryClient, "getAuditEscrow" | "getDiscrepancy" | "getGlobalState" | "getProviderState">;

interface ReconcileBlock {
  height: number;
  datetime: Date;
}

export interface ReconcileBlockSource {
  getLatestProcessedBlock(): Promise<ReconcileBlock | null>;
}

export interface ReconcileRepository {
  claimNext(): Promise<ClaimedProviderVerificationTarget | null>;
  complete(target: ClaimedProviderVerificationTarget, processedHeight: number): Promise<void>;
  enqueue(
    target: { targetType: "global" | "provider" | "all_providers"; targetKey: string },
    requestedHeight: number,
    transaction?: DbTransaction,
    invalidated?: boolean
  ): Promise<void>;
  enqueueAllProviders(requestedHeight: number, transaction?: DbTransaction, invalidated?: boolean): Promise<void>;
  fail(target: ClaimedProviderVerificationTarget, error: unknown): Promise<void>;
  findAuditEscrowProvider(id: string): Promise<string | null>;
  hasDiscrepancies(ids: readonly string[]): Promise<boolean>;
  replaceGlobalState(rows: ReturnType<typeof mapProviderVerificationGlobalState>): Promise<boolean>;
  replaceProviderState(rows: ReturnType<typeof mapProviderVerificationProviderState>): Promise<boolean>;
}

const defaultBlockSource: ReconcileBlockSource = {
  async getLatestProcessedBlock() {
    const block = await Block.findOne({ where: { isProcessed: true }, order: [["height", "DESC"]], attributes: ["height", "datetime"] });
    return block ? { height: block.height, datetime: block.datetime } : null;
  }
};

export class ProviderVerificationReconciler {
  constructor(
    private readonly client: VerificationQueryClient,
    private readonly repository: ReconcileRepository = new ProviderVerificationRepository(),
    private readonly blockSource: ReconcileBlockSource = defaultBlockSource
  ) {}

  async enqueueFullReconciliation(): Promise<void> {
    const block = await this.requireLatestProcessedBlock();
    await this.repository.enqueue({ targetType: "global", targetKey: "*" }, block.height, undefined, false);
    await this.repository.enqueueAllProviders(block.height, undefined, false);
  }

  async runBatch(limit = 25): Promise<number> {
    let processed = 0;
    while (processed < limit) {
      const target = await this.repository.claimNext();
      if (!target) break;

      try {
        const block = await this.requireLatestProcessedBlock(target.requestedHeight);
        await this.reconcileTarget(target, block);
        await this.repository.complete(target, block.height);
      } catch (error) {
        await this.repository.fail(target, error);
      }
      processed++;
    }
    return processed;
  }

  private async reconcileTarget(target: ClaimedProviderVerificationTarget, block: ReconcileBlock): Promise<void> {
    const height = block.height.toString();
    switch (target.targetType) {
      case "global":
      case "auditor":
        await this.reconcileGlobal(height, block.datetime);
        return;
      case "discrepancy": {
        const discrepancy = await this.client.getDiscrepancy(target.targetKey, height);
        await this.reconcileGlobal(height, block.datetime);
        if (discrepancy?.provider) await this.reconcileProvider(discrepancy.provider, height, block.datetime);
        return;
      }
      case "provider":
        await this.reconcileProvider(target.targetKey, height, block.datetime);
        return;
      case "audit_escrow": {
        const escrow = await this.client.getAuditEscrow(target.targetKey, height);
        const provider = escrow?.provider || (await this.repository.findAuditEscrowProvider(target.targetKey));
        if (provider) await this.reconcileProvider(provider, height, block.datetime);
        return;
      }
      case "all_providers":
        await this.repository.enqueueAllProviders(block.height);
        return;
    }
  }

  private async reconcileGlobal(height: string, blockTime: Date): Promise<void> {
    const state = await this.client.getGlobalState(height);
    if (!state.params) throw new Error(`Provider verification params are missing at height ${height}`);
    await this.repository.replaceGlobalState(mapProviderVerificationGlobalState(state, blockTime));
  }

  private async reconcileProvider(provider: string, height: string, blockTime: Date): Promise<void> {
    const state = await this.client.getProviderState(provider, height);
    const sourceDiscrepancyIds = state.grace?.sourceDiscrepancyIds.map(id => id.toString()) ?? [];
    if (!(await this.repository.hasDiscrepancies(sourceDiscrepancyIds))) {
      await this.reconcileGlobal(height, blockTime);
    }
    await this.repository.replaceProviderState(mapProviderVerificationProviderState(state, blockTime));
  }

  private async requireLatestProcessedBlock(minimumHeight = 0): Promise<ReconcileBlock> {
    const block = await this.blockSource.getLatestProcessedBlock();
    if (!block || block.height < minimumHeight) {
      throw new Error(`Provider verification state is not ready at height ${minimumHeight}`);
    }
    return block;
  }
}
