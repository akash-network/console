import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { InitialDeploymentFundingService } from "@src/deployment/services/initial-deployment-funding/initial-deployment-funding.service";
import type { InitialDeploymentFundingInstrumentationService } from "@src/deployment/services/initial-deployment-funding/initial-deployment-funding-instrumentation.service";
import { FundDeploymentHandler } from "./fund-deployment.handler";

describe(FundDeploymentHandler.name, () => {
  const payload: JobPayload<FundDeploymentCommand> = {
    walletId: 1,
    address: "akash1abc",
    dseq: "123",
    version: 1
  };

  it("delegates the payload identifiers to the funding service", async () => {
    const { handler, initialDeploymentFundingService } = setup();

    await handler.handle(payload);

    expect(initialDeploymentFundingService.fundOnLeaseStarted).toHaveBeenCalledWith({
      walletId: 1,
      address: "akash1abc",
      dseq: "123"
    });
  });

  it("records a successful job when the funding service resolves", async () => {
    const { handler, instrumentation } = setup();

    await handler.handle(payload);

    expect(instrumentation.recordJobSucceeded).toHaveBeenCalledWith(expect.any(Number));
    expect(instrumentation.recordJobFailed).not.toHaveBeenCalled();
  });

  it("records a failed job and rethrows when the funding service throws", async () => {
    const error = new Error("deposit failed");
    const { handler, instrumentation } = setup({
      initialDeploymentFundingService: { fundOnLeaseStarted: vi.fn().mockRejectedValue(error) }
    });

    await expect(handler.handle(payload)).rejects.toThrow(error);

    expect(instrumentation.recordJobFailed).toHaveBeenCalledWith(expect.any(Number), error);
    expect(instrumentation.recordJobSucceeded).not.toHaveBeenCalled();
  });

  function setup(params?: { initialDeploymentFundingService?: Partial<InitialDeploymentFundingService> }) {
    const initialDeploymentFundingService = mock<InitialDeploymentFundingService>({
      fundOnLeaseStarted: vi.fn().mockResolvedValue(undefined),
      ...params?.initialDeploymentFundingService
    });
    const instrumentation = mock<InitialDeploymentFundingInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const handler = new FundDeploymentHandler(initialDeploymentFundingService, instrumentation, createLogger);

    return { handler, initialDeploymentFundingService, instrumentation, logger };
  }
});
