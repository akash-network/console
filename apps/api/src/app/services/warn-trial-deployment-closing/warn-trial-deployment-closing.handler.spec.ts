import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { WarnTrialDeploymentClosingHandler } from "./warn-trial-deployment-closing.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYMENT_LINK = "https://console.akash.network/billing?payment=true";
const CLOSES_AT = "2026-11-06T21:20:00.000Z";

describe(WarnTrialDeploymentClosingHandler.name, () => {
  it("queues the closing warning for a trial deployment that is still active", async () => {
    const wallet = createUserWallet({ id: 123, userId: "user-123", address: "akash1test", isTrialing: true });
    const { handler, jobQueueService, deploymentService } = setup({ wallet });

    await handler.handle({ walletId: wallet.id, dseq: "test-dseq", closesAt: CLOSES_AT, version: 1 });

    expect(deploymentService.findByOwnerAndDseq).toHaveBeenCalledWith("akash1test", "test-dseq");
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new NotificationJob({
        template: "beforeCloseTrialDeployment",
        userId: "user-123",
        conditions: { trial: true },
        vars: {
          deploymentClosedAt: CLOSES_AT,
          dseq: "test-dseq",
          owner: "akash1test",
          paymentLink: PAYMENT_LINK,
          firstPurchaseBonus: "$resolved"
        }
      }),
      { singletonKey: `notification.beforeCloseTrialDeployment.test-dseq.${wallet.id}` }
    );
  });

  it("skips the warning when the owner already closed the deployment", async () => {
    const { handler, jobQueueService, logger } = setup({ deploymentState: "closed" });

    await handler.handle({ walletId: 123, dseq: "test-dseq", closesAt: CLOSES_AT, version: 1 });

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_WARNING",
      reason: "Deployment is not active",
      walletId: 123,
      dseq: "test-dseq",
      deploymentState: "closed"
    });
  });

  it.each([
    { case: "wallet is not found", wallet: null },
    { case: "wallet has left the trial", wallet: createUserWallet({ id: 123, address: "akash1test", isTrialing: false }) },
    { case: "wallet has no address", wallet: createUserWallet({ id: 123, address: null, isTrialing: true }) }
  ])("skips the warning without looking up the deployment when the $case", async ({ wallet }) => {
    const { handler, jobQueueService, deploymentService, logger } = setup({ wallet });

    await handler.handle({ walletId: 123, dseq: "test-dseq", closesAt: CLOSES_AT, version: 1 });

    expect(deploymentService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_WARNING",
      reason: "Wallet is not trialing or has no address",
      walletId: 123,
      dseq: "test-dseq"
    });
  });

  it("fails so the job retries when the chain does not return the deployment", async () => {
    const { handler, jobQueueService } = setup({ findDeployment: vi.fn().mockResolvedValue(undefined) });

    await expect(handler.handle({ walletId: 123, dseq: "test-dseq", closesAt: CLOSES_AT, version: 1 })).rejects.toThrow(
      "Failed to fetch trial deployment test-dseq: deployment not found"
    );
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("fails so the job retries when the chain answers with an error", async () => {
    const errorResponse = { code: 5, message: "rpc unavailable", details: [] };
    const { handler, jobQueueService } = setup({
      findDeployment: vi.fn().mockResolvedValue(errorResponse as unknown as GetDeploymentResponse["data"])
    });

    await expect(handler.handle({ walletId: 123, dseq: "test-dseq", closesAt: CLOSES_AT, version: 1 })).rejects.toThrow(
      "Failed to fetch trial deployment test-dseq: rpc unavailable"
    );
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: WarnTrialDeploymentClosingHandler.name });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(
    input: {
      wallet?: ReturnType<typeof createUserWallet> | null;
      deploymentState?: string;
      findDeployment?: DeploymentHttpService["findByOwnerAndDseq"];
    } = {}
  ) {
    const wallet = input.wallet === undefined ? createUserWallet({ id: 123, userId: "user-123", address: "akash1test", isTrialing: true }) : input.wallet;
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({ findById: vi.fn().mockResolvedValue(wallet) }),
      logger: mock<ReturnType<CreateLogger>>(),
      jobQueueService: mock<JobQueueService>({ enqueue: vi.fn().mockResolvedValue("job-id") }),
      deploymentService: mock<DeploymentHttpService>({
        findByOwnerAndDseq: input.findDeployment ?? vi.fn().mockResolvedValue({ deployment: { state: input.deploymentState ?? "active" } })
      }),
      billingConfig: mockConfigService<BillingConfigService>({ CONSOLE_WEB_PAYMENT_LINK: PAYMENT_LINK })
    };

    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

    const handler = new WarnTrialDeploymentClosingHandler(
      mocks.userWalletRepository,
      createLogger,
      mocks.jobQueueService,
      mocks.deploymentService,
      mocks.billingConfig
    );

    return { handler, createLogger, ...mocks };
  }
});
