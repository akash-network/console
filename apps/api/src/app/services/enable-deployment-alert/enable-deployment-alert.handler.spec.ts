import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import type { JobPayload } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { EnableDeploymentAlertHandler } from "./enable-deployment-alert.handler";

describe(EnableDeploymentAlertHandler.name, () => {
  it("calls autoEnableDeploymentAlert with the payload identifiers", async () => {
    const { handler, notificationService } = setup();

    const payload: JobPayload<EnableDeploymentAlertCommand> = {
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: EnableDeploymentAlertHandler.name });
  });

  function setup(params?: { notificationService?: Partial<NotificationService>; logger?: Partial<ReturnType<CreateLogger>> }) {
    const notificationService = mock<NotificationService>({
      autoEnableDeploymentAlert: vi.fn().mockResolvedValue(undefined),
      ...params?.notificationService
    });
    const logger = mock<ReturnType<CreateLogger>>({
      ...params?.logger
    });
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new EnableDeploymentAlertHandler(notificationService, createLogger);

    return { handler, notificationService, logger, createLogger };
  }
});
