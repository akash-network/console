import { beforeEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderCleanupService } from "@src/billing/services/provider-cleanup/provider-cleanup.service";
import { cacheEngine } from "@src/caching/helpers";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderStatsService } from "@src/provider/services/provider-stats/provider-stats.service";
import type { TrialProvidersService } from "@src/provider/services/trial-providers/trial-providers.service";
import { ProviderController } from "./provider.controller";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(ProviderController.name, () => {
  type ProviderListItem = Awaited<ReturnType<ProviderService["getProviderList"]>>[number];

  beforeEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  it("does not cache provider verification responses while AEP-86 is enabled", async () => {
    const { controller, providerService } = setup(true);
    providerService.getProviderList
      .mockResolvedValueOnce([{ owner: "akash1provider", verification: null } as unknown as ProviderListItem])
      .mockResolvedValueOnce([{ owner: "akash1provider", verification: { summary: { effectiveTier: "L3" } } } as unknown as ProviderListItem]);

    const beforeRecovery = JSON.parse(new TextDecoder().decode(await controller.getProviderListBuffer("all")));
    const afterRecovery = JSON.parse(new TextDecoder().decode(await controller.getProviderListBuffer("all")));

    expect(beforeRecovery[0].verification).toBeNull();
    expect(afterRecovery[0].verification.summary.effectiveTier).toBe("L3");
    expect(providerService.getProviderList).toHaveBeenCalledTimes(2);
  });

  it("keeps the existing serialized provider cache while AEP-86 is disabled", async () => {
    const { controller, providerService } = setup(false);
    providerService.getProviderList.mockResolvedValue([{ owner: "akash1provider", verification: null } as unknown as ProviderListItem]);

    await controller.getProviderListBuffer("all");
    await controller.getProviderListBuffer("all");

    expect(providerService.getProviderList).toHaveBeenCalledOnce();
  });

  function setup(verificationEnabled: boolean) {
    const providerService = mock<ProviderService>();
    const controller = new ProviderController(
      mock<TrialProvidersService>(),
      mock<ProviderCleanupService>(),
      providerService,
      mock<ProviderStatsService>(),
      mockConfigService<CoreConfigService>({ AEP86_PROVIDER_VERIFICATION_ENABLED: verificationEnabled })
    );

    return { controller, providerService };
  }
});
