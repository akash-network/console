import {
  VerificationBlockEvent,
  VerificationParams,
  VerificationProviderTierDemotion,
  VerificationProviderTierStream,
  VerificationReconcileTarget
} from "@akashnetwork/database/dbSchemas/akash";
import type { Sequelize, Transaction as DbTransaction } from "sequelize";
import { Op, Transaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderVerificationTierDemotionRepository } from "./provider-verification-tier-demotion.repository";

const originalSequelizeDescriptor = Object.getOwnPropertyDescriptor(VerificationProviderTierDemotion, "sequelize");

describe(ProviderVerificationTierDemotionRepository.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSequelizeDescriptor) {
      Object.defineProperty(VerificationProviderTierDemotion, "sequelize", originalSequelizeDescriptor);
    } else {
      Reflect.deleteProperty(VerificationProviderTierDemotion, "sequelize");
    }
  });

  it("reads the cursor feed and readiness state from one repeatable-read transaction", async () => {
    const transaction = {} as DbTransaction;
    const runTransaction = vi.fn(async (_options: unknown, callback: (value: DbTransaction) => unknown) => callback(transaction));
    Object.defineProperty(VerificationProviderTierDemotion, "sequelize", {
      configurable: true,
      value: { transaction: runTransaction } as unknown as Sequelize
    });

    const stream = { streamId: "a3d46e08-d84a-4ab5-b23c-08fc10a575f6" } as VerificationProviderTierStream;
    const params = { params: { verification_module_active: true } } as VerificationParams;
    const head = { id: "12" } as VerificationProviderTierDemotion;
    const demotions = [{ id: "11" }] as VerificationProviderTierDemotion[];
    vi.spyOn(VerificationProviderTierStream, "findByPk").mockResolvedValue(stream);
    vi.spyOn(VerificationParams, "findByPk").mockResolvedValue(params);
    const findOne = vi.spyOn(VerificationProviderTierDemotion, "findOne").mockResolvedValue(head);
    const findAll = vi.spyOn(VerificationProviderTierDemotion, "findAll").mockResolvedValue(demotions);
    const pendingTargets = vi.spyOn(VerificationReconcileTarget, "count").mockResolvedValue(0);
    const blockEvents = vi.spyOn(VerificationBlockEvent, "count").mockResolvedValue(0);

    await expect(new ProviderVerificationTierDemotionRepository().getFeed("10", 25)).resolves.toEqual({
      stream,
      params,
      demotions,
      headCursor: "12",
      globallyComplete: true
    });
    expect(runTransaction).toHaveBeenCalledWith({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, expect.any(Function));
    expect(findOne).toHaveBeenCalledWith({ attributes: ["id"], order: [["id", "DESC"]], transaction });
    expect(findAll).toHaveBeenCalledWith({ where: { id: { [Op.gt]: "10" } }, order: [["id", "ASC"]], limit: 25, transaction });
    expect(pendingTargets).toHaveBeenCalledWith({ where: { invalidated: true, targetType: { [Op.ne]: "provider" } }, transaction });
    expect(blockEvents).toHaveBeenCalledWith({ where: { isProcessed: false }, transaction });
  });

  it("marks the feed incomplete while global reconciliation or block events are pending", async () => {
    const transaction = {} as DbTransaction;
    Object.defineProperty(VerificationProviderTierDemotion, "sequelize", {
      configurable: true,
      value: { transaction: vi.fn(async (_options: unknown, callback: (value: DbTransaction) => unknown) => callback(transaction)) } as unknown as Sequelize
    });
    vi.spyOn(VerificationProviderTierStream, "findByPk").mockResolvedValue(null);
    vi.spyOn(VerificationParams, "findByPk").mockResolvedValue(null);
    vi.spyOn(VerificationProviderTierDemotion, "findOne").mockResolvedValue(null);
    vi.spyOn(VerificationProviderTierDemotion, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationReconcileTarget, "count").mockResolvedValue(1);
    vi.spyOn(VerificationBlockEvent, "count").mockResolvedValue(1);

    await expect(new ProviderVerificationTierDemotionRepository().getFeed("0", 100)).resolves.toMatchObject({
      headCursor: "0",
      globallyComplete: false
    });
  });
});
