import { describe, expect, it } from "vitest";

import type { PlacementAttributeType, ServiceType } from "@src/types";
import {
  getGpuInterconnectFabric,
  GPU_INTERCONNECT_CAPABILITY_KEY,
  GPU_INTERCONNECT_FABRIC_PREFIX,
  hasMixedInterconnectGroupForms,
  hasOtherInterconnectService,
  withGpuInterconnectCapability,
  withGpuInterconnectFabric,
  withoutGpuInterconnectCapability
} from "./gpuInterconnect";

describe(withGpuInterconnectCapability.name, () => {
  it("appends the capability with a generated id when absent", () => {
    const attributes: PlacementAttributeType[] = [{ id: "r1", key: "region", value: "us-west" }];

    const result = withGpuInterconnectCapability(attributes);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "r1", key: "region", value: "us-west" });
    expect(result[1]).toEqual({ id: expect.any(String), key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" });
  });

  it("upserts an existing row to true instead of appending a duplicate", () => {
    const attributes: PlacementAttributeType[] = [{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "false" }];

    const result = withGpuInterconnectCapability(attributes);

    expect(result).toEqual([{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]);
  });

  it("returns the same reference when the capability is already true", () => {
    const attributes: PlacementAttributeType[] = [{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }];

    expect(withGpuInterconnectCapability(attributes)).toBe(attributes);
  });

  it("builds the row from undefined attributes", () => {
    expect(withGpuInterconnectCapability(undefined)).toEqual([{ id: expect.any(String), key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]);
  });
});

describe(withoutGpuInterconnectCapability.name, () => {
  it("removes the capability and fabric pins while preserving unrelated rows", () => {
    const attributes: PlacementAttributeType[] = [
      { id: "r1", key: "region", value: "us-west" },
      { id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" },
      { id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" }
    ];

    const result = withoutGpuInterconnectCapability(attributes);

    expect(result).toEqual([{ id: "r1", key: "region", value: "us-west" }]);
  });

  it("returns the same reference when there is nothing to remove", () => {
    const attributes: PlacementAttributeType[] = [{ id: "r1", key: "region", value: "us-west" }];

    expect(withoutGpuInterconnectCapability(attributes)).toBe(attributes);
  });

  it("preserves undefined instead of allocating an empty array", () => {
    expect(withoutGpuInterconnectCapability(undefined)).toBeUndefined();
  });
});

describe(getGpuInterconnectFabric.name, () => {
  it("returns undefined when no fabric is pinned", () => {
    expect(getGpuInterconnectFabric(undefined)).toBeUndefined();
    expect(getGpuInterconnectFabric([{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }])).toBeUndefined();
  });

  it("reads a pinned fabric", () => {
    expect(getGpuInterconnectFabric([{ id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" }])).toBe("infiniband");
    expect(getGpuInterconnectFabric([{ id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}roce`, value: "true" }])).toBe("roce");
  });

  it("ignores an unknown fabric suffix", () => {
    expect(getGpuInterconnectFabric([{ id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}omni-path`, value: "true" }])).toBeUndefined();
  });

  it("ignores a pin that is not set to true", () => {
    expect(getGpuInterconnectFabric([{ id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "false" }])).toBeUndefined();
  });
});

describe(withGpuInterconnectFabric.name, () => {
  it("pins a fabric from undefined attributes", () => {
    expect(withGpuInterconnectFabric(undefined, "infiniband")).toEqual([
      { id: expect.any(String), key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" }
    ]);
  });

  it("replaces an existing pin while preserving unrelated rows", () => {
    const attributes: PlacementAttributeType[] = [
      { id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" },
      { id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" }
    ];

    expect(withGpuInterconnectFabric(attributes, "roce")).toEqual([
      { id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" },
      { id: expect.any(String), key: `${GPU_INTERCONNECT_FABRIC_PREFIX}roce`, value: "true" }
    ]);
  });

  it("removes every pin when the fabric is cleared", () => {
    const attributes: PlacementAttributeType[] = [
      { id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" },
      { id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" },
      { id: "f2", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}roce`, value: "true" }
    ];

    expect(withGpuInterconnectFabric(attributes, undefined)).toEqual([{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]);
  });

  it("returns the same reference when the fabric is already pinned", () => {
    const attributes: PlacementAttributeType[] = [{ id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}roce`, value: "true" }];

    expect(withGpuInterconnectFabric(attributes, "roce")).toBe(attributes);
  });

  it("returns the same reference when clearing with no pins present", () => {
    const attributes: PlacementAttributeType[] = [{ id: "r1", key: "region", value: "us-west" }];

    expect(withGpuInterconnectFabric(attributes, undefined)).toBe(attributes);
    expect(withGpuInterconnectFabric(undefined, undefined)).toBeUndefined();
  });

  it("normalizes an imported false pin to a single true pin", () => {
    const attributes: PlacementAttributeType[] = [{ id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "false" }];

    expect(withGpuInterconnectFabric(attributes, "infiniband")).toEqual([
      { id: expect.any(String), key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" }
    ]);
  });
});

describe(hasOtherInterconnectService.name, () => {
  it("finds a same-placement sibling that opts in", () => {
    const services = [service("p1"), service("p1", {})];

    expect(hasOtherInterconnectService(services, 0)).toBe(true);
  });

  it("ignores an opted-in service on a different placement", () => {
    const services = [service("p1"), service("p2", {})];

    expect(hasOtherInterconnectService(services, 0)).toBe(false);
  });

  it("ignores the service itself", () => {
    const services = [service("p1", {})];

    expect(hasOtherInterconnectService(services, 0)).toBe(false);
  });
});

describe(hasMixedInterconnectGroupForms.name, () => {
  it("is false when the service itself does not opt in", () => {
    const services = [service("p1"), service("p1", { group: "pair0" })];

    expect(hasMixedInterconnectGroupForms(services, 0)).toBe(false);
  });

  it("is false when every opted-in service on the placement uses the implicit form", () => {
    const services = [service("p1", {}), service("p1", {})];

    expect(hasMixedInterconnectGroupForms(services, 0)).toBe(false);
  });

  it("detects an implicit service next to an explicit same-placement sibling", () => {
    const services = [service("p1", {}), service("p1", { group: "pair0" })];

    expect(hasMixedInterconnectGroupForms(services, 0)).toBe(true);
    expect(hasMixedInterconnectGroupForms(services, 1)).toBe(true);
  });

  it("ignores a differently-formed service on another placement", () => {
    const services = [service("p1", {}), service("p2", { group: "pair0" })];

    expect(hasMixedInterconnectGroupForms(services, 0)).toBe(false);
  });

  it("allows two different explicit groups on one placement", () => {
    const services = [service("p1", { group: "pair0" }), service("p1", { group: "pair1" })];

    expect(hasMixedInterconnectGroupForms(services, 0)).toBe(false);
  });
});

function service(placementId: string, interconnect?: { group?: string }): Pick<ServiceType, "placementId" | "profile"> {
  return { placementId, profile: { cpu: 0.1, ram: 512, ramUnit: "Mi", storage: [], interconnect } };
}
