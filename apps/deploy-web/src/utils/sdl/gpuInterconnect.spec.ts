import { describe, expect, it } from "vitest";

import type { PlacementAttributeType, ServiceType } from "@src/types";
import {
  GPU_INTERCONNECT_CAPABILITY_KEY,
  GPU_INTERCONNECT_FABRIC_PREFIX,
  hasOtherInterconnectService,
  withGpuInterconnectCapability,
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

  function service(placementId: string, interconnect?: { group?: string }): Pick<ServiceType, "placementId" | "profile"> {
    return { placementId, profile: { cpu: 0.1, ram: 512, ramUnit: "Mi", storage: [], interconnect } };
  }
});
