import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { useDeclaredGpuInterconnect } from "./useDeclaredGpuInterconnect";

import { renderHook } from "@testing-library/react";
import { buildRpcDeployment } from "@tests/seeders";

describe(useDeclaredGpuInterconnect.name, () => {
  it("reports the interconnect opt-in and pinned fabrics from the deployment's on-chain groups", () => {
    const groups = buildRpcDeployment({
      groups: [
        {
          group_spec: {
            requirements: {
              attributes: [
                { key: "capabilities/gpu-interconnect", value: "true" },
                { key: "capabilities/gpu-interconnect/fabric/infiniband", value: "true" }
              ]
            }
          }
        }
      ]
    }).groups;
    const { result } = setup({ deployment: mock<DeploymentDto>({ groups }) });
    expect(result.current).toEqual({ enabled: true, fabrics: ["infiniband"] });
  });

  it("returns a disabled result when the deployment is not loaded", () => {
    const { result } = setup({ deployment: undefined });
    expect(result.current).toEqual({ enabled: false, fabrics: [] });
  });

  function setup(input: { deployment: DeploymentDto | undefined }) {
    return renderHook(() => useDeclaredGpuInterconnect(input.deployment));
  }
});
