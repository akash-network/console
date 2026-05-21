import type { SDLInput } from "@akashnetwork/chain-sdk";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "./blocked-gpu.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBid } from "@test/seeders/bid.seeder";

describe(BlockedGpuService.name, () => {
  describe("findInSdl", () => {
    it("returns matching GPUs when the SDL requests a blocked model", () => {
      const { service } = setup({ blockedGpuModels: ["nvidia/h100"] });

      expect(service.findInSdl(buildSdlWithGpu("nvidia", "h100"))).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });

    it("returns empty when no requested GPU matches the blocked-set", () => {
      const { service } = setup({ blockedGpuModels: ["nvidia/h100"] });

      expect(service.findInSdl(buildSdlWithGpu("nvidia", "rtx-4090"))).toEqual([]);
    });

    it("returns empty when the blocked-set is empty", () => {
      const { service } = setup({ blockedGpuModels: [] });

      expect(service.findInSdl(buildSdlWithGpu("nvidia", "h100"))).toEqual([]);
    });
  });

  describe("findInGroupSpecs", () => {
    it("returns matching GPUs when groups request a blocked model", () => {
      const { service } = setup({ blockedGpuModels: ["nvidia/h100"] });
      const groups = MsgCreateDeployment.fromPartial({
        groups: [
          {
            name: "test",
            resources: [
              {
                resource: {
                  id: 1,
                  gpu: {
                    units: { val: new Uint8Array([1]) },
                    attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }]
                  }
                },
                count: 1
              }
            ]
          }
        ]
      }).groups;

      expect(service.findInGroupSpecs(groups)).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });

    it("returns empty when the blocked-set is empty", () => {
      const { service } = setup({ blockedGpuModels: [] });

      expect(service.findInGroupSpecs([])).toEqual([]);
    });
  });

  describe("findInBid", () => {
    it("returns matching GPUs when the bid offers a blocked model", () => {
      const { service } = setup({ blockedGpuModels: ["nvidia/h100"] });
      const bid = createBid();
      bid.bid.resources_offer[0].resources.gpu = {
        units: { val: "1" },
        attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }]
      };

      expect(service.findInBid(bid)).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });

    it("returns empty when the offered GPU is not blocked", () => {
      const { service } = setup({ blockedGpuModels: ["nvidia/h100"] });
      const bid = createBid();
      bid.bid.resources_offer[0].resources.gpu = {
        units: { val: "1" },
        attributes: [{ key: "vendor/nvidia/model/rtx-4090", value: "true" }]
      };

      expect(service.findInBid(bid)).toEqual([]);
    });
  });

  describe("hasBlockedModels", () => {
    it("returns true when the config lists at least one model", () => {
      const { service } = setup({ blockedGpuModels: ["nvidia/h100"] });

      expect(service.hasBlockedModels()).toBe(true);
    });

    it("returns false when the config is empty", () => {
      const { service } = setup({ blockedGpuModels: [] });

      expect(service.hasBlockedModels()).toBe(false);
    });
  });

  describe("formatList", () => {
    it("renders a comma-separated label list", () => {
      const { service } = setup({ blockedGpuModels: [] });

      expect(
        service.formatList([
          { vendor: "nvidia", model: "h100" },
          { vendor: "nvidia", model: "a100" }
        ])
      ).toBe("Nvidia H100, Nvidia A100");
    });

    it("returns an empty string for an empty list", () => {
      const { service } = setup({ blockedGpuModels: [] });

      expect(service.formatList([])).toBe("");
    });
  });

  function setup(input: { blockedGpuModels: string[] }) {
    const billingConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: input.blockedGpuModels
    });
    const service = new BlockedGpuService(billingConfig);
    return { service, billingConfig };
  }

  function buildSdlWithGpu(vendor: string, model: string): SDLInput {
    return {
      version: "2.0",
      services: {},
      profiles: {
        compute: {
          web: {
            resources: {
              cpu: { units: "0.5" },
              memory: { size: "512Mi" },
              storage: { size: "1Gi" },
              gpu: {
                units: 1,
                attributes: {
                  vendor: {
                    [vendor]: [{ model }]
                  }
                }
              }
            }
          }
        },
        placement: {}
      },
      deployment: {}
    } as unknown as SDLInput;
  }
});
