import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundDrainingDeploymentsCommand } from "@src/billing/commands/fund-draining-deployments.command";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { FundDrainingDeploymentsInstrumentationService } from "@src/deployment/services/top-up-managed-deployments/fund-draining-deployments-instrumentation.service";
import type { TopUpManagedDeploymentsService } from "@src/deployment/services/top-up-managed-deployments/top-up-managed-deployments.service";
import { FundDrainingDeploymentsHandler } from "./fund-draining-deployments.handler";

describe(FundDrainingDeploymentsHandler.name, () => {
  const payload: JobPayload<FundDrainingDeploymentsCommand> = {
    walletId: 1,
    address: "akash1abc",
    version: 1
  };

  it("funds the owner's draining deployments and records job success", async () => {
    const { handler, topUpManagedDeploymentsService, instrumentation } = setup();

    await handler.handle(payload);

    expect(topUpManagedDeploymentsService.topUpDrainingDeploymentsForOwner).toHaveBeenCalledWith({
      walletId: 1,
      address: "akash1abc"
    });
    expect(instrumentation.recordJobSucceeded).toHaveBeenCalledWith(expect.any(Number));
    expect(instrumentation.recordJobFailed).not.toHaveBeenCalled();
  });

  it("records the failure and rethrows when funding throws so the job can retry", async () => {
    const error = new Error("deposit failed");
    const { handler, instrumentation } = setup({
      topUpManagedDeploymentsService: { topUpDrainingDeploymentsForOwner: vi.fn().mockRejectedValue(error) }
    });

    await expect(handler.handle(payload)).rejects.toThrow(error);
    expect(instrumentation.recordJobFailed).toHaveBeenCalledWith(expect.any(Number), error);
    expect(instrumentation.recordJobSucceeded).not.toHaveBeenCalled();
  });

  it("uses the singleton policy so the per-wallet singletonKey serializes same-wallet funding", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("singleton");
  });

  function setup(params?: { topUpManagedDeploymentsService?: Partial<TopUpManagedDeploymentsService> }) {
    const topUpManagedDeploymentsService = mock<TopUpManagedDeploymentsService>({
      topUpDrainingDeploymentsForOwner: vi.fn().mockResolvedValue(undefined),
      ...params?.topUpManagedDeploymentsService
    });
    const instrumentation = mock<FundDrainingDeploymentsInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const handler = new FundDrainingDeploymentsHandler(topUpManagedDeploymentsService, instrumentation, createLogger);

    return { handler, topUpManagedDeploymentsService, instrumentation, logger };
  }
});
