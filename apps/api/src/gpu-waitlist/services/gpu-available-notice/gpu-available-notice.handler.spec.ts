import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import type { CreateLogger } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { GpuAvailableNoticeHandler } from "./gpu-available-notice.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";

describe(GpuAvailableNoticeHandler.name, () => {
  it("emails the waiting user with the setup, price and links", async () => {
    const { handler, notificationService, user } = setup({});

    await handler.handle({ entryId: "entry-1", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith({
      notificationId: "gpuAvailable.entry-1.1",
      payload: {
        summary: "8× H100 80Gi SXM5 is available on Akash",
        description: expect.stringContaining("from $2.5/hr"),
        actions: [
          {
            label: "Deploy now",
            url: "https://console.example.com/new-deployment/configure?gpuVendor=nvidia&gpuModel=h100&gpuCount=8&gpuMemory=80Gi&gpuInterface=sxm5"
          },
          { label: "Stop these alerts", url: "https://console.example.com/gpu-requests?leaveAlert=entry-1" }
        ]
      },
      user: { id: user.id, email: user.email }
    });
  });

  it("is sent once per wave", async () => {
    const { handler, notificationService } = setup({});

    await handler.handle({ entryId: "entry-1", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });
    await handler.handle({ entryId: "entry-1", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });
    await handler.handle({ entryId: "entry-1", waveNumber: 2, priceUsdPerHour: 2.5, version: 1 });

    const ids = notificationService.createNotification.mock.calls.map(([input]) => input.notificationId);
    expect(ids).toEqual(["gpuAvailable.entry-1.1", "gpuAvailable.entry-1.1", "gpuAvailable.entry-1.2"]);
  });

  it("tells trialing users to add a payment method", async () => {
    const { handler, notificationService } = setup({ isTrialing: true });

    await handler.handle({ entryId: "entry-1", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ description: expect.stringContaining("Add a payment method to deploy GPUs") }) })
    );
  });

  it.each(["fulfilled", "left", "expired"] as const)("skips an entry that has ended as %s", async status => {
    const { handler, notificationService } = setup({ status });

    await handler.handle({ entryId: "entry-1", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("skips and logs when the entry is gone", async () => {
    const { handler, notificationService, entryRepository, logger } = setup({});
    entryRepository.findByIdAcrossOrganizations.mockResolvedValue(undefined);

    await handler.handle({ entryId: "missing", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId: "missing", reason: "Entry not found" });
  });

  it("skips and logs when the user has no email", async () => {
    const { handler, notificationService, userRepository, logger } = setup({});
    userRepository.findById.mockResolvedValue(undefined);

    await handler.handle({ entryId: "entry-1", waveNumber: 1, priceUsdPerHour: 2.5, version: 1 });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId: "entry-1", reason: "User or email not found" });
  });

  it("needs no permissions and logs under its own name", () => {
    const { handler, createLogger } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
    expect(createLogger).toHaveBeenCalledWith({ context: GpuAvailableNoticeHandler.name });
  });

  function setup(input: { status?: GpuWaitlistEntryRow["status"]; isTrialing?: boolean }) {
    const user = createUser({ email: "jane@example.com" });
    const entry = mock<GpuWaitlistEntryRow>({
      id: "entry-1",
      userId: user.id,
      organizationId: null,
      vendor: "nvidia",
      model: "h100",
      memory: "80Gi",
      interface: "sxm5",
      gpuCount: 8,
      status: input.status ?? "waiting"
    });
    const entryRepository = mock<GpuWaitlistEntryRepository>();
    entryRepository.findByIdAcrossOrganizations.mockResolvedValue(entry);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(user);
    const wallets = mock<UserWalletRepository>();
    wallets.findOneByUserId.mockResolvedValue({ isTrialing: input.isTrialing ?? false } as Awaited<ReturnType<UserWalletRepository["findOneByUserId"]>>);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.unscoped.mockReturnValue(wallets);
    const notificationService = mock<NotificationService>();
    const deploymentConfigService = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL: "https://console.example.com" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new GpuAvailableNoticeHandler(
      entryRepository,
      userRepository,
      userWalletRepository,
      notificationService,
      deploymentConfigService,
      createLogger
    );

    return { handler, entryRepository, userRepository, notificationService, logger, createLogger, user };
  }
});
