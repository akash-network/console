import { describe, expect, it } from "vitest";

import { describeGpuSetup } from "./describeGpuSetup";

describe(describeGpuSetup.name, () => {
  it("describes the count, model, memory and interface in the email's format", () => {
    expect(describeGpuSetup({ model: "h100", gpuCount: 8, memory: "80Gi", interface: "sxm" })).toBe("8× H100 80Gi SXM");
  });

  it("leaves out the memory and interface a setup does not pin", () => {
    expect(describeGpuSetup({ model: "a100", gpuCount: 1, memory: null })).toBe("1× A100");
  });
});
