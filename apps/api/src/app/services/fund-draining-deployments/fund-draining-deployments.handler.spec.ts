import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundDrainingDeploymentsCommand } from "@src/billing/commands/fund-draining-deployments.command";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { FundDrainingDeploymentsHandler } from "./fund-draining-deployments.handler";

describe(FundDrainingDeploymentsHandler.name, () => {
  const payload: JobPayload<FundDrainingDeploymentsCommand> = {
    walletId: 1,
    address: "akash1abc",
    version: 1
  };

  it("funds the owner's draining deployments for the payload identifiers", async () => {
    const { handler, topUpManagedDeploymentsService } = setup();

    await handler.handle(payload);

    expect(topUpManagedDeploymentsService.topUpDrainingDeploymentsForOwner).toHaveBeenCalledWith({
      walletId: 1,
      address: "akash1abc"
    });
  });

  it("logs and rethrows when the funding service throws so the job can retry", async () => {
    const error = new Error("deposit failed");
    const { handler, logger } = setup({
      topUpManagedDeploymentsService: { topUpDrainingDeploymentsForOwner: vi.fn().mockRejectedValue(error) }
    });

    await expect(handler.handle(payload)).rejects.toThrow(error);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_DEPLOYMENTS_FAILED", error }));
  });

  function setup(params?: { topUpManagedDeploymentsService?: Partial<TopUpManagedDeploymentsService> }) {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>({
      topUpDrainingDeploymentsForOwner: vi.fn().mockResolvedValue(undefined),
      ...params?.topUpManagedDeploymentsService
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const handler = new FundDrainingDeploymentsHandler(topUpManagedDeploymentsService, createLogger);

    return { handler, topUpManagedDeploymentsService, logger };
  }
});
