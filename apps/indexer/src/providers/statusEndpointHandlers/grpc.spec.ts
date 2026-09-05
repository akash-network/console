import type { CPUInfo } from "@akashnetwork/chain-sdk/private-types/provider.akash.v1";
import { describe, expect, it } from "vitest";

import { mapCpuInfo } from "./grpc";

describe(mapCpuInfo.name, () => {
  it("keeps the architecture a node reports", () => {
    const result = mapCpuInfo(buildCpuInfo({ arch: "arm64" }));

    expect(result.arch).toBe("arm64");
  });

  it("records no architecture when the inventory operator reports an empty one", () => {
    const result = mapCpuInfo(buildCpuInfo({ arch: "" }));

    expect(result.arch).toBeNull();
  });

  it("carries the vendor, model and vcores through unchanged", () => {
    const result = mapCpuInfo(buildCpuInfo({ vendor: "GenuineIntel", model: "Xeon", vcores: 16 }));

    expect(result).toEqual({ vendor: "GenuineIntel", model: "Xeon", vcores: 16, arch: null });
  });

  function buildCpuInfo(overrides: Partial<CPUInfo> = {}): CPUInfo {
    return {
      id: "cpu-0",
      vendor: "AuthenticAMD",
      model: "EPYC",
      vcores: 8,
      arch: "",
      ...overrides
    };
  }
});
