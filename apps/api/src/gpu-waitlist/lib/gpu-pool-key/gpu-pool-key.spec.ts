import { describe, expect, it } from "vitest";

import { toPoolKey } from "./gpu-pool-key";

describe(toPoolKey.name, () => {
  it("lowercases every part", () => {
    expect(toPoolKey({ vendor: "NVIDIA", model: "H100", memory: "80Gi", interface: "SXM5" })).toBe("nvidia/h100/80gi/sxm5");
  });

  it("uses * for a missing memory or interface", () => {
    expect(toPoolKey({ vendor: "nvidia", model: "h100" })).toBe("nvidia/h100/*/*");
    expect(toPoolKey({ vendor: "nvidia", model: "h100", memory: "80Gi", interface: null })).toBe("nvidia/h100/80gi/*");
    expect(toPoolKey({ vendor: "nvidia", model: "h100", memory: null, interface: "pcie" })).toBe("nvidia/h100/*/pcie");
  });
});
