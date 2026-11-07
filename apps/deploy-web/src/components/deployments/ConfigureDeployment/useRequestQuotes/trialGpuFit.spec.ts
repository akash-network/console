import { describe, expect, it } from "vitest";

import type { ServiceType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import { describeTrialGpuBlocks, dropTrialBlockedGpuModels } from "./trialGpuFit";

const BLOCKED = ["nvidia/h100", "nvidia/a100"];

describe("trialGpuFit", () => {
  describe(dropTrialBlockedGpuModels.name, () => {
    it("keeps only the GPU models the trial allows", () => {
      const services = [
        buildService({
          gpuModels: [
            { vendor: "nvidia", name: "h100", memory: "80Gi" },
            { vendor: "nvidia", name: "t4" }
          ]
        })
      ];

      expect(dropTrialBlockedGpuModels(services, BLOCKED)?.[0].profile.gpuModels).toEqual([{ vendor: "nvidia", name: "t4" }]);
    });

    it("leaves services without a blocked GPU model untouched", () => {
      const services = [
        buildService({ gpuModels: [{ vendor: "nvidia", name: "t4" }] }),
        buildService({ hasGpu: false, gpuModels: [{ vendor: "nvidia", name: "h100" }] })
      ];

      const fitted = dropTrialBlockedGpuModels(services, BLOCKED);

      expect(fitted?.[0]).toBe(services[0]);
      expect(fitted?.[1]).toBe(services[1]);
    });

    it("returns undefined when a service would have no GPU model left", () => {
      const services = [buildService({ gpuModels: [{ vendor: "nvidia", name: "t4" }] }), buildService({ gpuModels: [{ vendor: "nvidia", name: "h100" }] })];

      expect(dropTrialBlockedGpuModels(services, BLOCKED)).toBeUndefined();
    });

    it("treats any model of a vendor with blocked models as blocked", () => {
      const services = [buildService({ gpuModels: [{ vendor: "nvidia", name: "" }] })];

      expect(dropTrialBlockedGpuModels(services, BLOCKED)).toBeUndefined();
    });
  });

  describe(describeTrialGpuBlocks.name, () => {
    it("asks to remove the one blocked model a service also accepts", () => {
      const services = [
        buildService({
          title: "llm",
          gpuModels: [
            { vendor: "nvidia", name: "h100", interface: "sxm" },
            { vendor: "nvidia", name: "h100", interface: "pcie" },
            { vendor: "nvidia", name: "t4" }
          ]
        })
      ];

      expect(describeTrialGpuBlocks(services, BLOCKED)).toEqual([
        `Service "llm" also accepts NVIDIA H100, which the free trial doesn't allow. Remove it from its GPU models.`
      ]);
    });

    it("explains every service the trial blocks for its GPU, skipping the rest", () => {
      const services = [
        buildService({ title: "web", gpuModels: [{ vendor: "nvidia", name: "t4" }] }),
        buildService({ title: "cpu", hasGpu: false, gpuModels: [{ vendor: "nvidia", name: "h100" }] }),
        buildService({ title: "llm", gpuModels: [{ vendor: "nvidia", name: "a100" }] })
      ];

      expect(describeTrialGpuBlocks(services, BLOCKED)).toEqual([
        `Service "llm" asks for NVIDIA A100, which the free trial doesn't allow. Choose a GPU model your trial allows, or add credits.`
      ]);
    });

    it("blocks nothing when the trial blocks no GPU model", () => {
      const services = [buildService({ gpuModels: [{ vendor: "nvidia", name: "" }] })];

      expect(describeTrialGpuBlocks(services, [])).toEqual([]);
    });
  });

  function buildService(input: { title?: string; hasGpu?: boolean; gpuModels: NonNullable<ServiceType["profile"]["gpuModels"]> }): ServiceType {
    const service = defaultService("placement-1", { title: input.title ?? "service-1" });
    return { ...service, profile: { ...service.profile, hasGpu: input.hasGpu ?? true, gpuModels: input.gpuModels } };
  }
});
