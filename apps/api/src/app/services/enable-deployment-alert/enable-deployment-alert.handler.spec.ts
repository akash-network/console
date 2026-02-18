import type { DeploymentHttpService, DeploymentInfo, RestAkashDeploymentInfoResponse } from "@akashnetwork/http-sdk";
import { mock } from "vitest-mock-extended";

import type { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import type { JobPayload } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { EnableDeploymentAlertHandler } from "./enable-deployment-alert.handler";

describe(EnableDeploymentAlertHandler.name, () => {
  it("fetches deployment and calls autoEnableDeploymentAlert with escrow balance", async () => {
    const { handler, notificationService, deploymentHttpService } = setup();

    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
      escrow_account: {
        state: {
          funds: [{ denom: "uakt", amount: "1000000" }]
        }
      }
    } as DeploymentInfo);

    const payload: JobPayload<EnableDeploymentAlertCommand> = {
      userId: "user-1",
      walletAddress: "akash1abc",
      dseq: "123",
      version: 1
    };

    await handler.handle(payload);

    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith("akash1abc", "123");
    expect(notificationService.autoEnableDeploymentAlert).toHaveBeenCalledWith({
      userId: "user-1",
      walletAddress: "akash1abc",
      dseq: "123",
      escrowBalance: 1000000
    });
  });

  it("skips when deployment is not found", async () => {
    const { handler, notificationService, deploymentHttpService } = setup();

    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({ code: 5, message: "not found", details: [] } satisfies RestAkashDeploymentInfoResponse);

    const payload: JobPayload<EnableDeploymentAlertCommand> = {
      userId: "user-1",
      walletAddress: "akash1abc",
      dseq: "123",
      version: 1
    };

    await handler.handle(payload);

    expect(notificationService.autoEnableDeploymentAlert).not.toHaveBeenCalled();
  });

  function setup(params?: {
    notificationService?: Partial<NotificationService>;
    deploymentHttpService?: Partial<DeploymentHttpService>;
    logger?: Partial<LoggerService>;
  }) {
    const notificationService = mock<NotificationService>({
      autoEnableDeploymentAlert: jest.fn().mockResolvedValue(undefined),
      ...params?.notificationService
    });
    const deploymentHttpService = mock<DeploymentHttpService>({
      ...params?.deploymentHttpService
    });
    const logger = mock<LoggerService>({
      ...params?.logger
    });

    const handler = new EnableDeploymentAlertHandler(notificationService, deploymentHttpService, logger);

    return { handler, notificationService, deploymentHttpService, logger };
  }
});
