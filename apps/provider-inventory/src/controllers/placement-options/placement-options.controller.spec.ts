import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AvailableGpu, OnlineRegion, PlacementOptionsRepository } from "@src/repositories/placement-options/placement-options.repository";
import { PlacementOptionsController } from "./placement-options.controller";

describe(PlacementOptionsController.name, () => {
  it("answers with the online regions and how many providers advertise each", async () => {
    const { controller } = setup({
      onlineRegions: [
        { region: "eu-west", providerCount: 2 },
        { region: "na-us-west", providerCount: 5 }
      ]
    });

    const options = await controller.getPlacementOptions();

    expect(options.regions).toEqual(["eu-west", "na-us-west"]);
    expect(options.regionProviderCounts).toEqual({ "eu-west": 2, "na-us-west": 5 });
  });

  it("answers with the available gpus grouped by vendor", async () => {
    const { controller } = setup({
      availableGpus: [
        { owner: "akash1provider", vendor: "nvidia", model: "a100", memory: "80Gi", interface: "sxm", advertisedGpuKeys: ["vendor/nvidia/model/a100"] }
      ]
    });

    const options = await controller.getPlacementOptions();

    expect(options.gpus).toEqual([
      {
        vendor: "nvidia",
        models: [{ name: "a100", memory: [], interface: [], providerCount: 1, variants: [{ memory: null, interface: null, providerCount: 1 }] }]
      }
    ]);
  });

  it("answers with no options when no provider is online", async () => {
    const { controller } = setup();

    expect(await controller.getPlacementOptions()).toEqual({ regions: [], regionProviderCounts: {}, gpus: [] });
  });

  function setup(input?: { onlineRegions?: OnlineRegion[]; availableGpus?: AvailableGpu[] }) {
    const placementOptionsRepository = mock<PlacementOptionsRepository>();
    placementOptionsRepository.findOnlineRegions.mockResolvedValue(input?.onlineRegions ?? []);
    placementOptionsRepository.findAvailableGpus.mockResolvedValue(input?.availableGpus ?? []);

    const controller = new PlacementOptionsController(placementOptionsRepository);

    return { controller, placementOptionsRepository };
  }
});
