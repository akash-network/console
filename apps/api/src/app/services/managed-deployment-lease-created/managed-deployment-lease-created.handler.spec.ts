import { mock } from "vitest-mock-extended";

import type { ManagedDeploymentLeaseCreated } from "@src/billing/events/managed-deployment-lease-created";
import type { EventPayload } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { ManagedDeploymentLeaseCreatedHandler } from "./managed-deployment-lease-created.handler";

describe(ManagedDeploymentLeaseCreatedHandler.name, () => {
  it("calls notificationService.autoEnableDeploymentAlert with correct params", async () => {
    const { handler, notificationService } = setup();

    const payload: EventPayload<ManagedDeploymentLeaseCreated> = {
      userId: "user-1",
      walletAddress: "akash1abc",
      dseq: "123",
      version: 1
    };

    await handler.handle(payload);

    expect(notificationService.autoEnableDeploymentAlert).toHaveBeenCalledWith({
      userId: "user-1",
      walletAddress: "akash1abc",
      dseq: "123"
    });
  });

  function setup() {
    const mocks = {
      notificationService: mock<NotificationService>({
        autoEnableDeploymentAlert: jest.fn().mockResolvedValue(undefined)
      }),
      logger: mock<LoggerService>()
    };

    const handler = new ManagedDeploymentLeaseCreatedHandler(mocks.notificationService, mocks.logger);

    return { handler, ...mocks };
  }
});
