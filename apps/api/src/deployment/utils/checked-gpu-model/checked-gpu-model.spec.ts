import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import { findCheckedGpuModel } from "./checked-gpu-model";

describe(findCheckedGpuModel.name, () => {
  it("reads the one gpu model a group is pinned to, whatever follows it in the attribute", () => {
    expect(findCheckedGpuModel(aGroup(["vendor/nvidia/model/h100/ram/80Gi"], ["vendor/nvidia/model/h100"]))).toEqual({ vendor: "nvidia", model: "h100" });
  });

  it("reads no model from a group that accepts several", () => {
    expect(findCheckedGpuModel(aGroup(["vendor/nvidia/model/h100", "vendor/nvidia/model/a100"]))).toBeNull();
  });

  it.each([[["vendor/nvidia/model/*"]], [["vendor/nvidia/model/h100*"]], [["vendor/nvidia/model/*", "vendor/nvidia/model/a100"]]])(
    "reads no model from a group that accepts models no check names: %j",
    keys => {
      expect(findCheckedGpuModel(aGroup(keys))).toBeNull();
    }
  );

  it("reads no model from a group without a gpu", () => {
    expect(findCheckedGpuModel(aGroup([]))).toBeNull();
  });

  function aGroup(...resourcesKeys: string[][]): GroupSpec {
    return GroupSpec.fromPartial({
      name: "dcloud",
      resources: resourcesKeys.map(keys => ({ resource: { gpu: { attributes: keys.map(key => ({ key, value: "true" })) } } }))
    });
  }
});
