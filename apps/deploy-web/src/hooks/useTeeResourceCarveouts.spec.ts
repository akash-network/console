import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { useTeeResourceCarveouts } from "./useTeeResourceCarveouts";

import { renderHook } from "@testing-library/react";
import { buildRpcDeployment } from "@tests/seeders";

describe(useTeeResourceCarveouts.name, () => {
  it("returns a per-pod carve-out for each resource unit in the lease's on-chain group", () => {
    const group = buildRpcDeployment({
      groups: [{ group_spec: { requirements: { attributes: [{ key: "tee/type", value: "cpu" }] } } }]
    }).groups[0];
    const { result } = setup({ lease: mock<LeaseDto>({ group }) });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].teeType).toBe("cpu");
  });

  it("returns an empty array when the lease has no matched group", () => {
    const { result } = setup({ lease: mock<LeaseDto>({ group: undefined }) });
    expect(result.current).toEqual([]);
  });

  function setup(input: { lease: LeaseDto }) {
    return renderHook(() => useTeeResourceCarveouts(input.lease));
  }
});
