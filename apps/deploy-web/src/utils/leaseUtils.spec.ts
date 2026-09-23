import { describe, expect, it } from "vitest";

import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { hasLiveGpuLease, keepSelectedLease } from "./leaseUtils";

describe("leaseUtils", () => {
  describe("hasLiveGpuLease", () => {
    it("is true when a live lease has a GPU", () => {
      expect(hasLiveGpuLease([createLease({ state: "active", gpuAmount: 1 })])).toBe(true);
    });

    it("is false when the GPU lease is not live", () => {
      expect(hasLiveGpuLease([createLease({ state: "closed", gpuAmount: 1 })])).toBe(false);
    });

    it("is false when no live lease has a GPU", () => {
      expect(hasLiveGpuLease([createLease({ state: "active", gpuAmount: 0 })])).toBe(false);
    });

    it("is false for empty or missing leases", () => {
      expect(hasLiveGpuLease([])).toBe(false);
      expect(hasLiveGpuLease(null)).toBe(false);
      expect(hasLiveGpuLease(undefined)).toBe(false);
    });
  });

  describe("keepSelectedLease", () => {
    it("keeps the lease already picked, as the list now has it", () => {
      const leases = [{ id: "1" }, { id: "2", state: "closed" }];

      expect(keepSelectedLease({ id: "2", state: "active" }, leases)).toBe(leases[1]);
    });

    it("falls back to the first lease once the picked one is no longer listed", () => {
      const leases = [{ id: "1" }, { id: "2" }];

      expect(keepSelectedLease({ id: "3" }, leases)).toBe(leases[0]);
    });

    it("starts on the first lease when nothing was picked", () => {
      const leases = [{ id: "1" }, { id: "2" }];

      expect(keepSelectedLease(null, leases)).toBe(leases[0]);
    });
  });

  function createLease(overrides: { state?: string; gpuAmount?: number } = {}): LeaseDto {
    return {
      id: "1",
      owner: "owner1",
      provider: "provider1",
      dseq: "1",
      gseq: 1,
      oseq: 1,
      state: overrides.state ?? "active",
      price: { denom: "uakt", amount: "100" },
      cpuAmount: 0,
      gpuAmount: overrides.gpuAmount,
      memoryAmount: 0,
      storageAmount: 0,
      group: { state: "open" } as DeploymentGroup
    } as LeaseDto;
  }
});
