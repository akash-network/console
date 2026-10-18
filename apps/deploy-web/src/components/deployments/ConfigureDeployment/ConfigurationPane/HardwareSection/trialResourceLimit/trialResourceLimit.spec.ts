import { describe, expect, it } from "vitest";

import { describeDeploymentSize, describeTrialResourceLimit, exceedsTrialResourceLimit, measureDeploymentSize } from "./trialResourceLimit";

import { buildSDLService } from "@tests/seeders";

describe("trialResourceLimit", () => {
  describe(measureDeploymentSize.name, () => {
    it("sums CPU and memory across every service and replica", () => {
      const services = [serviceOf({ cpu: 2, ram: 4, count: 3 }), serviceOf({ cpu: 1, ram: 512, ramUnit: "Mi" })];

      expect(measureDeploymentSize(services)).toEqual({ cpu: 7, memoryGi: 12.5 });
    });

    it("rounds away the floating point noise of fractional CPU so a total at the cap stays at the cap", () => {
      const services = Array.from({ length: 40 }, () => serviceOf({ cpu: 0.1, ram: 1 }));

      expect(measureDeploymentSize(services).cpu).toBe(4);
    });
  });

  describe(exceedsTrialResourceLimit.name, () => {
    it("allows a deployment that uses exactly the trial's CPU and memory", () => {
      expect(exceedsTrialResourceLimit({ cpu: 4, memoryGi: 16 }, { maxCpu: 4, maxMemoryGi: 16 })).toBe(false);
    });

    it("refuses a deployment over the CPU cap alone", () => {
      expect(exceedsTrialResourceLimit({ cpu: 4.5, memoryGi: 1 }, { maxCpu: 4, maxMemoryGi: 16 })).toBe(true);
    });

    it("refuses a deployment over the memory cap alone", () => {
      expect(exceedsTrialResourceLimit({ cpu: 1, memoryGi: 16.5 }, { maxCpu: 4, maxMemoryGi: 16 })).toBe(true);
    });

    it("ignores a CPU cap switched off with zero", () => {
      expect(exceedsTrialResourceLimit({ cpu: 96, memoryGi: 1 }, { maxCpu: 0, maxMemoryGi: 16 })).toBe(false);
    });

    it("ignores a memory cap switched off with zero", () => {
      expect(exceedsTrialResourceLimit({ cpu: 1, memoryGi: 512 }, { maxCpu: 4, maxMemoryGi: 0 })).toBe(false);
    });
  });

  describe(describeTrialResourceLimit.name, () => {
    it("names both caps", () => {
      expect(describeTrialResourceLimit({ maxCpu: 4, maxMemoryGi: 16 })).toBe("4 vCPU and 16 GiB of memory");
    });

    it("names only the CPU cap when the memory cap is switched off", () => {
      expect(describeTrialResourceLimit({ maxCpu: 4, maxMemoryGi: 0 })).toBe("4 vCPU");
    });

    it("names only the memory cap when the CPU cap is switched off", () => {
      expect(describeTrialResourceLimit({ maxCpu: 0, maxMemoryGi: 16 })).toBe("16 GiB of memory");
    });
  });

  describe(describeDeploymentSize.name, () => {
    it("states CPU and memory to two decimals", () => {
      expect(describeDeploymentSize({ cpu: 16, memoryGi: 300.126 })).toBe("16 vCPU and 300.13 GiB of memory");
    });
  });

  function serviceOf(input: { cpu: number; ram: number; ramUnit?: string; count?: number }) {
    const service = buildSDLService({ count: input.count ?? 1 });
    return { ...service, profile: { ...service.profile, cpu: input.cpu, ram: input.ram, ramUnit: input.ramUnit ?? "Gi" } };
  }
});
