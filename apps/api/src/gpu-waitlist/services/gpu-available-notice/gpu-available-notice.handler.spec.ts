import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import type {
  HardwareRequestAccountService,
  HardwareRequestAccountType
} from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories";
import { GpuAvailableNoticeHandler } from "./gpu-available-notice.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUser } from "@test/seeders/user.seeder";

const PAYLOAD = { entryId: "entry-1", waveNumber: 1, pricePerGpuUsdPerHour: 2.5, version: 1 } as const;

describe(GpuAvailableNoticeHandler.name, () => {
  it("emails the waiting user with the setup, price per gpu and links", async () => {
    const { handler, notificationService, user } = setup({});

    await handler.handle(PAYLOAD);

    expect(notificationService.createNotificationOnce).toHaveBeenCalledWith({
      notificationId: "gpuAvailable.entry-1.1",
      payload: {
        summary: "8× H100 80Gi SXM5 is available on Akash",
        description: expect.stringContaining("from $2.50 per GPU/hr"),
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

  it("scopes the links to the organization of a team entry", async () => {
    const { handler, notificationService, accountService } = setup({ organizationId: "org-1" });

    await handler.handle(PAYLOAD);

    expect(accountService.findAccountType).toHaveBeenCalledWith({ userId: expect.any(String), organizationId: "org-1" });
    expect(notificationService.createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          actions: [
            expect.objectContaining({ url: expect.stringContaining("&org=org-1") }),
            { label: "Stop these alerts", url: "https://console.example.com/gpu-requests?leaveAlert=entry-1&org=org-1" }
          ]
        })
      })
    );
  });

  it("keys the notification on the entry and wave", async () => {
    const { handler, notificationService } = setup({});

    await handler.handle(PAYLOAD);
    await handler.handle(PAYLOAD);
    await handler.handle({ ...PAYLOAD, waveNumber: 2 });

    const ids = notificationService.createNotificationOnce.mock.calls.map(([input]) => input.notificationId);
    expect(ids).toEqual(["gpuAvailable.entry-1.1", "gpuAvailable.entry-1.1", "gpuAvailable.entry-1.2"]);
  });

  it.each([
    { accountType: "trial", isTrial: true },
    { accountType: "paying", isTrial: false },
    { accountType: "no_card", isTrial: false }
  ] as const)("treats a $accountType account as trial: $isTrial", async ({ accountType, isTrial }) => {
    const { handler, notificationService } = setup({ accountType });

    await handler.handle(PAYLOAD);

    const description = notificationService.createNotificationOnce.mock.calls[0][0].payload.description;
    expect(description.includes("Add a payment method to deploy GPUs")).toBe(isTrial);
  });

  it.each(["fulfilled", "left", "expired"] as const)("skips an entry that has ended as %s", async status => {
    const { handler, notificationService } = setup({ status });

    await handler.handle(PAYLOAD);

    expect(notificationService.createNotificationOnce).not.toHaveBeenCalled();
  });

  it("skips and logs when the entry is gone", async () => {
    const { handler, notificationService, entryRepository, logger } = setup({});
    entryRepository.findByIdAcrossOrganizations.mockResolvedValue(undefined);

    await handler.handle({ ...PAYLOAD, entryId: "missing" });

    expect(notificationService.createNotificationOnce).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId: "missing", reason: "Entry not found" });
  });

  it("skips and logs when the user has no email", async () => {
    const { handler, notificationService, userRepository, logger } = setup({});
    userRepository.findById.mockResolvedValue(undefined);

    await handler.handle(PAYLOAD);

    expect(notificationService.createNotificationOnce).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId: "entry-1", reason: "User or email not found" });
  });

  it("sends nothing and settles without a retry while the feature is off", async () => {
    const { handler, notificationService, entryRepository, featureFlagsService, logger } = setup({ flagEnabled: false });

    await expect(handler.handle(PAYLOAD)).resolves.toBeUndefined();

    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.GPU_AVAILABILITY_ALERTS, {});
    expect(entryRepository.findByIdAcrossOrganizations).not.toHaveBeenCalled();
    expect(notificationService.createNotificationOnce).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId: "entry-1", reason: "Feature flag is off" });
  });

  it("sends nothing on a network that does not serve gpu waitlists", async () => {
    const { handler, notificationService, entryRepository, logger } = setup({ servesGpuWaitlists: false });

    await expect(handler.handle(PAYLOAD)).resolves.toBeUndefined();

    expect(entryRepository.findByIdAcrossOrganizations).not.toHaveBeenCalled();
    expect(notificationService.createNotificationOnce).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId: "entry-1", reason: "Network does not serve gpu waitlists" });
  });

  it("needs no permissions and logs under its own name", () => {
    const { handler, createLogger } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
    expect(createLogger).toHaveBeenCalledWith({ context: GpuAvailableNoticeHandler.name });
  });

  function setup(input: {
    status?: GpuWaitlistEntryRow["status"];
    accountType?: HardwareRequestAccountType;
    organizationId?: string;
    flagEnabled?: boolean;
    servesGpuWaitlists?: boolean;
  }) {
    const user = createUser({ email: "jane@example.com" });
    const entry = mock<GpuWaitlistEntryRow>({
      id: "entry-1",
      userId: user.id,
      organizationId: input.organizationId ?? null,
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
    const accountService = mock<HardwareRequestAccountService>();
    accountService.findAccountType.mockResolvedValue(input.accountType ?? "paying");
    const notificationService = mock<NotificationService>();
    const deploymentConfigService = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL: "https://console.example.com" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn(() => input.flagEnabled ?? true) });
    const gpuWaitlistNetworkService = mock<GpuWaitlistNetworkService>({ servesGpuWaitlists: vi.fn(() => input.servesGpuWaitlists ?? true) });
    const handler = new GpuAvailableNoticeHandler(
      entryRepository,
      userRepository,
      accountService,
      notificationService,
      deploymentConfigService,
      featureFlagsService,
      gpuWaitlistNetworkService,
      createLogger
    );

    return { handler, entryRepository, userRepository, accountService, notificationService, featureFlagsService, logger, createLogger, user };
  }
});
