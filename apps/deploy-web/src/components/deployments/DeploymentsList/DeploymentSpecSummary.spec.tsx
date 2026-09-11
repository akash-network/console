import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { DeploymentSpecSummary } from "./DeploymentSpecSummary";

import { render, screen } from "@testing-library/react";

describe("DeploymentSpecSummary", () => {
  it("summarises vCPU, memory and storage", () => {
    setup({ cpuAmount: 4, memoryAmount: 16_000_000_000, storageAmount: 40_000_000_000 });

    expect(screen.getByLabelText("vCPU")).toHaveTextContent("4");
    expect(screen.getByLabelText("Memory")).toHaveTextContent("16 GB");
    expect(screen.getByLabelText("Storage")).toHaveTextContent("40 GB");
  });

  it("names the GPU model rather than counting anonymous GPUs", () => {
    setup({
      gpuAmount: 1,
      groups: [
        { group_spec: { resources: [{ resource: { gpu: { attributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] } } }] } }
      ] as DeploymentDto["groups"]
    });

    expect(screen.getByLabelText("GPU")).toHaveTextContent("H100");
  });

  it("omits the GPU entry for a deployment without one", () => {
    setup({ gpuAmount: 0 });

    expect(screen.queryByLabelText("GPU")).not.toBeInTheDocument();
  });

  function setup(input: Partial<DeploymentDto>) {
    render(<DeploymentSpecSummary deployment={mock<DeploymentDto>({ cpuAmount: 1, memoryAmount: 1, storageAmount: 1, gpuAmount: 0, groups: [], ...input })} />);

    return input;
  }
});
