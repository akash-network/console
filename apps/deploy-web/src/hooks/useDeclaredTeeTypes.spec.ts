import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { useDeclaredTeeTypes } from "./useDeclaredTeeTypes";

import { renderHook } from "@testing-library/react";
import { buildRpcDeployment } from "@tests/seeders";

describe(useDeclaredTeeTypes.name, () => {
  it("returns the distinct declared TEE types across the deployment's on-chain groups", () => {
    const groups = buildRpcDeployment({
      groups: [{ group_spec: { requirements: { attributes: [{ key: "tee/type", value: "cpu-gpu" }] } } }]
    }).groups;
    const { result } = setup({ deployment: mock<DeploymentDto>({ groups }) });
    expect(result.current).toEqual(["cpu-gpu"]);
  });

  it("returns an empty array when the deployment is not loaded", () => {
    const { result } = setup({ deployment: undefined });
    expect(result.current).toEqual([]);
  });

  function setup(input: { deployment: DeploymentDto | undefined }) {
    return renderHook(() => useDeclaredTeeTypes(input.deployment));
  }
});
