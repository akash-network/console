import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { formatByteSize } from "@src/utils/unitUtils";
import { GpuLabel } from "./GpuLabel";
import { buildPlacementStats } from "./PlacementStats";

describe(buildPlacementStats.name, () => {
  it("lists the placement's vCPU, memory, storage and service count", () => {
    const lease = mock<LeaseDto>({ cpuAmount: 2.345, memoryAmount: 4 * 1024 ** 3, storageAmount: 20 * 1024 ** 3, gpuAmount: 0 });

    expect(buildPlacementStats(lease, 3, { models: [] })).toEqual([
      { label: "vCPU", value: 2.35 },
      { label: "Memory", value: formatByteSize(4 * 1024 ** 3) },
      { label: "Storage", value: formatByteSize(20 * 1024 ** 3) },
      { label: "Services", value: 3 }
    ]);
  });

  it("labels the lease's gpus before the service count when it holds some", () => {
    const lease = mock<LeaseDto>({ cpuAmount: 1, memoryAmount: 1024 ** 3, storageAmount: 1024 ** 3, gpuAmount: 2 });
    const resolved = [{ displayName: "A100", count: 2 }];

    const stats = buildPlacementStats(lease, 1, { models: ["a100"], resolved, isLoading: true });

    expect(stats.map(stat => stat.label)).toEqual(["vCPU", "Memory", "Storage", "GPU", "Services"]);
    expect(stats[3]).toEqual({ label: "GPU", value: <GpuLabel gpuAmount={2} models={["a100"]} resolved={resolved} isLoading /> });
  });
});
