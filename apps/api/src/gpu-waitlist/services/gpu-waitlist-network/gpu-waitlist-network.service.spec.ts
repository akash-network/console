import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/config/env.config";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistNetworkService } from "./gpu-waitlist-network.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(GpuWaitlistNetworkService.name, () => {
  describe("servesGpuWaitlists", () => {
    it("serves waitlists on a listed network", () => {
      const { service } = setup({ network: "mainnet", waitlistNetworks: ["mainnet"] });

      expect(service.servesGpuWaitlists()).toBe(true);
    });

    it("does not serve waitlists on a network left out of the list", () => {
      const { service } = setup({ network: "sandbox", waitlistNetworks: ["mainnet"] });

      expect(service.servesGpuWaitlists()).toBe(false);
    });

    it("serves waitlists on every listed network", () => {
      const { service } = setup({ network: "sandbox", waitlistNetworks: ["mainnet", "sandbox"] });

      expect(service.servesGpuWaitlists()).toBe(true);
    });
  });

  function setup(input: { network: CoreConfig["NETWORK"]; waitlistNetworks: GpuWaitlistConfig["GPU_WAITLIST_NETWORKS"] }) {
    const coreConfigService = mockConfigService<CoreConfigService>({ NETWORK: input.network });
    const config = mock<GpuWaitlistConfig>({ GPU_WAITLIST_NETWORKS: input.waitlistNetworks });

    return { service: new GpuWaitlistNetworkService(coreConfigService, config) };
  }
});
