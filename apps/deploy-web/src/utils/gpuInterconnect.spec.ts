import type { QueryInput as DeepPartial } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import type { DeploymentGroup } from "@src/types/deployment";
import { formatGpuInterconnectFabricLabel, getDeclaredGpuInterconnect, getGroupGpuInterconnect } from "./gpuInterconnect";

import { buildRpcDeployment } from "@tests/seeders";

const CAPABILITY_KEY = "capabilities/gpu-interconnect";
const FABRIC_PREFIX = "capabilities/gpu-interconnect/fabric/";

/** Builds a single on-chain deployment group, seeded with realistic defaults and the given overrides. */
function buildGroup(spec?: DeepPartial<DeploymentGroup>): DeploymentGroup {
  return buildRpcDeployment(spec ? { groups: [spec] } : undefined).groups[0];
}

/** Builds a group whose on-chain placement requirements carry the given attributes. */
function buildGroupWithAttributes(attributes: { key: string; value: string }[]): DeploymentGroup {
  return buildGroup({ group_spec: { requirements: { attributes } } });
}

describe(getGroupGpuInterconnect.name, () => {
  it("marks a group with the interconnect capability as enabled", () => {
    const group = buildGroupWithAttributes([{ key: CAPABILITY_KEY, value: "true" }]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: true, fabric: undefined });
  });

  it("captures the pinned fabric slug alongside the capability", () => {
    const group = buildGroupWithAttributes([
      { key: CAPABILITY_KEY, value: "true" },
      { key: `${FABRIC_PREFIX}infiniband`, value: "true" }
    ]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: true, fabric: "infiniband" });
  });

  it('treats a non-"true" capability value as not enabled', () => {
    const group = buildGroupWithAttributes([{ key: CAPABILITY_KEY, value: "false" }]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: false });
  });

  it("returns not enabled when the capability attribute is absent", () => {
    const group = buildGroupWithAttributes([{ key: "region", value: "us-west" }]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: false });
  });

  it("ignores an orphaned fabric pin left without the base capability", () => {
    const group = buildGroupWithAttributes([{ key: `${FABRIC_PREFIX}roce`, value: "true" }]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: false });
  });

  it("ignores an empty fabric slug", () => {
    const group = buildGroupWithAttributes([
      { key: CAPABILITY_KEY, value: "true" },
      { key: FABRIC_PREFIX, value: "true" }
    ]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: true, fabric: undefined });
  });

  it("skips an empty fabric suffix and selects a later valid fabric pin", () => {
    const group = buildGroupWithAttributes([
      { key: CAPABILITY_KEY, value: "true" },
      { key: FABRIC_PREFIX, value: "true" },
      { key: `${FABRIC_PREFIX}infiniband`, value: "true" }
    ]);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: true, fabric: "infiniband" });
  });

  it("ignores a non-string attribute key without throwing", () => {
    const attributes = [
      { key: CAPABILITY_KEY, value: "true" },
      { key: 123, value: "true" }
    ] as unknown as { key: string; value: string }[];
    const group = buildGroupWithAttributes(attributes);
    expect(getGroupGpuInterconnect(group)).toEqual({ enabled: true, fabric: undefined });
  });

  it("returns not enabled for a missing or malformed group", () => {
    expect(getGroupGpuInterconnect(undefined)).toEqual({ enabled: false });
    expect(getGroupGpuInterconnect(null)).toEqual({ enabled: false });
  });
});

describe(getDeclaredGpuInterconnect.name, () => {
  it("returns disabled with no fabrics when the group list is missing", () => {
    expect(getDeclaredGpuInterconnect(undefined)).toEqual({ enabled: false, fabrics: [] });
    expect(getDeclaredGpuInterconnect(null)).toEqual({ enabled: false, fabrics: [] });
  });

  it("returns enabled with no fabrics when a group opts in without pinning a fabric", () => {
    const groups = [buildGroupWithAttributes([{ key: CAPABILITY_KEY, value: "true" }])];
    expect(getDeclaredGpuInterconnect(groups)).toEqual({ enabled: true, fabrics: [] });
  });

  it("collects the distinct pinned fabrics across all enabled groups", () => {
    const groups = [
      buildGroupWithAttributes([
        { key: CAPABILITY_KEY, value: "true" },
        { key: `${FABRIC_PREFIX}infiniband`, value: "true" }
      ]),
      buildGroupWithAttributes([
        { key: CAPABILITY_KEY, value: "true" },
        { key: `${FABRIC_PREFIX}roce`, value: "true" }
      ]),
      buildGroupWithAttributes([
        { key: CAPABILITY_KEY, value: "true" },
        { key: `${FABRIC_PREFIX}infiniband`, value: "true" }
      ])
    ];
    expect(getDeclaredGpuInterconnect(groups)).toEqual({ enabled: true, fabrics: ["infiniband", "roce"] });
  });

  it("stays enabled when only some groups opt in", () => {
    const groups = [buildGroupWithAttributes([{ key: "region", value: "us-west" }]), buildGroupWithAttributes([{ key: CAPABILITY_KEY, value: "true" }])];
    expect(getDeclaredGpuInterconnect(groups)).toEqual({ enabled: true, fabrics: [] });
  });
});

describe(formatGpuInterconnectFabricLabel.name, () => {
  it("maps known fabric slugs to their display names", () => {
    expect(formatGpuInterconnectFabricLabel("infiniband")).toBe("InfiniBand");
    expect(formatGpuInterconnectFabricLabel("roce")).toBe("RoCE");
  });

  it("title-cases an unknown fabric slug", () => {
    expect(formatGpuInterconnectFabricLabel("custom")).toBe("Custom");
  });
});
