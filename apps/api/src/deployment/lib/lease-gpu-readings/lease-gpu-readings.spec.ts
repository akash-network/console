import { describe, expect, it } from "vitest";

import { mergeLeaseGpuReadings } from "./lease-gpu-readings";

import { createLeaseGpuReading } from "@test/seeders/lease-gpu-reading.seeder";

describe(mergeLeaseGpuReadings.name, () => {
  it("replaces the stored reading of a service read again", () => {
    const stored = createLeaseGpuReading({ provider: "akash1provider", driverVersion: "550.54.15" });
    const reread = createLeaseGpuReading({ provider: "akash1provider", driverVersion: "565.57.01" });

    expect(mergeLeaseGpuReadings([stored], [reread])).toEqual([reread]);
  });

  it("keeps the readings of every service, lease and placement it was not given", () => {
    const web = createLeaseGpuReading({ provider: "akash1provider", service: "web" });
    const worker = createLeaseGpuReading({ provider: "akash1provider", service: "worker" });
    const otherOrder = createLeaseGpuReading({ provider: "akash1provider", oseq: 2 });
    const otherGroup = createLeaseGpuReading({ provider: "akash1provider", gseq: 2 });
    const otherProvider = createLeaseGpuReading({ provider: "akash1other" });
    const reread = createLeaseGpuReading({ provider: "akash1provider", service: "web", driverVersion: "565.57.01" });

    expect(mergeLeaseGpuReadings([web, worker, otherOrder, otherGroup, otherProvider], [reread])).toEqual([
      worker,
      otherOrder,
      otherGroup,
      otherProvider,
      reread
    ]);
  });

  it("adds a reading for a service never read before", () => {
    const web = createLeaseGpuReading({ service: "web" });
    const worker = createLeaseGpuReading({ service: "worker" });

    expect(mergeLeaseGpuReadings([], [web, worker])).toEqual([web, worker]);
  });
});
