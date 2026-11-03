import { describe, expect, it } from "vitest";

import {
  describeDeploymentSize,
  describeTrialResourceLimit,
  exceedsTrialResourceLimit,
  fitServicesToTrialResourceLimit,
  measureDeploymentSize
} from "./trialResourceLimit";

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

  describe(fitServicesToTrialResourceLimit.name, () => {
    const LIMIT = { maxCpu: 4, maxMemoryGi: 16 };

    it("brings an oversized service down to the trial's CPU and memory", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 16, ram: 64 })], LIMIT);

      expect(profilesOf(fitted)).toEqual([{ cpu: 4, ram: 16, ramUnit: "Gi" }]);
    });

    it("leaves memory alone when only the CPU is over the limit", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 8, ram: 512, ramUnit: "Mi" })], LIMIT);

      expect(profilesOf(fitted)).toEqual([{ cpu: 4, ram: 512, ramUnit: "Mi" }]);
    });

    it("leaves CPU alone when only the memory is over the limit", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 1.5, ram: 32 })], LIMIT);

      expect(profilesOf(fitted)).toEqual([{ cpu: 1.5, ram: 16, ramUnit: "Gi" }]);
    });

    it("shrinks every service by the same share, counting each replica", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 2, ram: 8, count: 3 }), serviceOf({ cpu: 2, ram: 8 })], LIMIT);

      expect(profilesOf(fitted)).toEqual([
        { cpu: 1, ram: 4, ramUnit: "Gi" },
        { cpu: 1, ram: 4, ramUnit: "Gi" }
      ]);
      expect(measureDeploymentSize(fitted!)).toEqual({ cpu: 4, memoryGi: 16 });
    });

    it("rounds each service down to a tenth of a vCPU and a whole MiB", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 2, ram: 16 }), serviceOf({ cpu: 4, ram: 32 })], { maxCpu: 4, maxMemoryGi: 32 });

      expect(profilesOf(fitted)).toEqual([
        { cpu: 1.3, ram: 10922, ramUnit: "Mi" },
        { cpu: 2.6, ram: 21845, ramUnit: "Mi" }
      ]);
    });

    it("lands exactly on a limit that floating point arithmetic would put just below it", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 22, ram: 22 })], { maxCpu: 15, maxMemoryGi: 15 });

      expect(profilesOf(fitted)).toEqual([{ cpu: 15, ram: 15, ramUnit: "Gi" }]);
    });

    it("keeps every service at the smallest size it can run with", () => {
      const fitted = fitServicesToTrialResourceLimit(
        [serviceOf({ cpu: 0.1, ram: 1, ramUnit: "Mi" }), serviceOf({ cpu: 10, ram: 64 })],
        { maxCpu: 1, maxMemoryGi: 1 }
      );

      expect(profilesOf(fitted)).toEqual([
        { cpu: 0.1, ram: 1, ramUnit: "Mi" },
        { cpu: 0.9, ram: 1023, ramUnit: "Mi" }
      ]);
    });

    it("gives up when even the smallest sizes exceed the limit", () => {
      const services = Array.from({ length: 11 }, () => serviceOf({ cpu: 1, ram: 1 }));

      expect(fitServicesToTrialResourceLimit(services, { maxCpu: 1, maxMemoryGi: 16 })).toBeUndefined();
    });

    it("ignores a CPU cap switched off with zero", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 96, ram: 64 })], { maxCpu: 0, maxMemoryGi: 16 });

      expect(profilesOf(fitted)).toEqual([{ cpu: 96, ram: 16, ramUnit: "Gi" }]);
    });

    it("ignores a memory cap switched off with zero", () => {
      const fitted = fitServicesToTrialResourceLimit([serviceOf({ cpu: 16, ram: 512 })], { maxCpu: 4, maxMemoryGi: 0 });

      expect(profilesOf(fitted)).toEqual([{ cpu: 4, ram: 512, ramUnit: "Gi" }]);
    });

    it("keeps the rest of each service as it was", () => {
      const service = serviceOf({ cpu: 16, ram: 64, count: 2 });

      const [fitted] = fitServicesToTrialResourceLimit([service], LIMIT)!;

      expect(fitted).toEqual({ ...service, profile: { ...service.profile, cpu: 2, ram: 8, ramUnit: "Gi" } });
    });

    function profilesOf(services: ReturnType<typeof fitServicesToTrialResourceLimit>) {
      return services?.map(({ profile: { cpu, ram, ramUnit } }) => ({ cpu, ram, ramUnit }));
    }
  });

  function serviceOf(input: { cpu: number; ram: number; ramUnit?: string; count?: number }) {
    const service = buildSDLService({ count: input.count ?? 1 });
    return { ...service, profile: { ...service.profile, cpu: input.cpu, ram: input.ram, ramUnit: input.ramUnit ?? "Gi" } };
  }
});
