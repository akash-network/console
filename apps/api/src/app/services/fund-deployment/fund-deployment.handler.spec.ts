import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { InitialDeploymentFundingService } from "@src/deployment/services/initial-deployment-funding/initial-deployment-funding.service";
import { FundDeploymentHandler } from "./fund-deployment.handler";

describe(FundDeploymentHandler.name, () => {
  it("delegates the payload identifiers to the funding service", async () => {
    const { handler, initialDeploymentFundingService } = setup();

    const payload: JobPayload<FundDeploymentCommand> = {
      walletId: 1,
      address: "akash1abc",
      dseq: "123",
      version: 1
    };

    await handler.handle(payload);

    expect(initialDeploymentFundingService.fundOnLeaseStarted).toHaveBeenCalledWith({
      walletId: 1,
      address: "akash1abc",
      dseq: "123"
    });
  });

  function setup(params?: { initialDeploymentFundingService?: Partial<InitialDeploymentFundingService> }) {
    const initialDeploymentFundingService = mock<InitialDeploymentFundingService>({
      fundOnLeaseStarted: vi.fn().mockResolvedValue(undefined),
      ...params?.initialDeploymentFundingService
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const handler = new FundDeploymentHandler(initialDeploymentFundingService, createLogger);

    return { handler, initialDeploymentFundingService, logger };
  }
});
