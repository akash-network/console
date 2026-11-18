import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProviderCpuModel } from "@src/types/provider";
import { CpuModelsCard, formatBaseFrequency, formatCpuDetails, formatCpuGeneration, formatUnreportedNodesNote } from "./CpuModelsCard";

import { render, screen, within } from "@testing-library/react";

describe(CpuModelsCard.name, () => {
  it("lists each CPU model with its generation, base frequency, threads and nodes", () => {
    setup({
      models: [
        buildModel({ vendor: "AMD", model: "EPYC 7763", generation: "Milan", threads: 256, nodeCount: 2 }),
        buildModel({ vendor: "Intel", model: "Xeon Gold 6248R", generation: "Cascade Lake", baseFrequencyMhz: 3000, threads: 96, nodeCount: 1 })
      ],
      profile: "mixed"
    });

    const table = screen.getByRole("table", { name: "CPU models" });
    expect(within(table).getByRole("row", { name: /AMD EPYC 7763 .*Milan Not in the name 256 2$/ })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Intel Xeon Gold 6248R .*Cascade Lake 3\.00 GHz 96 1$/ })).toBeInTheDocument();
    expect(screen.queryByText(/no CPU report/)).not.toBeInTheDocument();
  });

  it("says a mixed provider can place a deployment on any of its models", () => {
    setup({ models: [buildModel({ model: "EPYC 7763" }), buildModel({ model: "EPYC 9654" })], profile: "mixed" });

    expect(screen.getByText("mixed")).toBeInTheDocument();
    expect(screen.getByText("The nodes run more than one CPU model, and a deployment can land on any of them.")).toBeInTheDocument();
  });

  it("says how many nodes report no model when the others report one", () => {
    setup({ models: [buildModel({ model: "EPYC 7763" })], profile: "mixed", unreportedNodeCount: 1 });

    expect(screen.getByText("mixed")).toBeInTheDocument();
    expect(screen.getByText("1 node doesn't report a CPU model, and a deployment can land on it.")).toBeInTheDocument();
    expect(screen.queryByText(/more than one CPU model/)).not.toBeInTheDocument();
  });

  it("says the physical model is unknown when the nodes only report a hypervisor CPU", () => {
    setup({ models: [buildModel({ model: "QEMU Virtual version 2.5+", isVirtual: true })], profile: "virtual" });

    expect(screen.getByText("virtual")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /QEMU Virtual version 2\.5\+ .*Virtual 64 1$/ })).toBeInTheDocument();
    expect(screen.getByText("The nodes report the CPU their hypervisor emulates, so the physical model is unknown.")).toBeInTheDocument();
  });

  it("leaves the base frequency column out when no model name carries one", () => {
    setup({ models: [buildModel({ model: "EPYC 7763" }), buildModel({ model: "EPYC 9654" })], profile: "mixed" });

    expect(screen.queryByRole("columnheader", { name: "Base frequency" })).not.toBeInTheDocument();
    expect(screen.queryByText("Not in the name")).not.toBeInTheDocument();
  });

  it("adds no note for a provider that runs a single model", () => {
    setup({ models: [buildModel({ model: "EPYC 7763" })], profile: "uniform" });

    expect(screen.queryByText("uniform")).not.toBeInTheDocument();
    expect(screen.queryByText(/The nodes/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CPU models" }).querySelector("p")).toBeNull();
  });

  it("says the CPUs are unknown when the nodes report none", () => {
    setup({ models: [], profile: "unknown" });

    expect(screen.getByText("Unknown. Console has no CPU report for this provider.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("unknown")).not.toBeInTheDocument();
  });

  it("keeps the generation and base frequency under the model name for narrow screens", () => {
    setup({ models: [buildModel({ model: "Xeon Gold 6248R", generation: "Cascade Lake", baseFrequencyMhz: 3000 })], profile: "uniform" });

    expect(screen.getByText("Cascade Lake · 3.00 GHz")).toHaveClass("sm:hidden");
    expect(screen.getByRole("columnheader", { name: "Generation" })).toHaveClass("hidden", "sm:table-cell");
    expect(screen.getByRole("columnheader", { name: "Base frequency" })).toHaveClass("hidden", "sm:table-cell");
  });

  it("keeps a physical and a virtual CPU with the same name as two rows", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    setup({ models: [buildModel({ model: "Xeon Gold 6248R" }), buildModel({ model: "Xeon Gold 6248R", isVirtual: true })], profile: "mixed" });

    expect(screen.getAllByRole("row", { name: /Xeon Gold 6248R/ })).toHaveLength(2);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    consoleError.mockRestore();
  });

  function buildModel(overrides: Partial<ProviderCpuModel>): ProviderCpuModel {
    return { vendor: "AMD", model: "EPYC 7763", generation: null, baseFrequencyMhz: null, isVirtual: false, threads: 64, nodeCount: 1, ...overrides };
  }

  function setup(props: ComponentProps<typeof CpuModelsCard>) {
    render(<CpuModelsCard {...props} />);
  }
});

describe(formatCpuGeneration.name, () => {
  it.each([
    [{ generation: "Milan", isVirtual: false }, "Milan"],
    [{ generation: null, isVirtual: false }, "Unknown"],
    [{ generation: null, isVirtual: true }, "Virtual"]
  ])("formats %j as %s", (model, expected) => {
    expect(formatCpuGeneration(model)).toBe(expected);
  });
});

describe(formatBaseFrequency.name, () => {
  it.each([
    [3000, "3.00 GHz"],
    [2250, "2.25 GHz"],
    [800, "0.80 GHz"],
    [null, "Not in the name"]
  ])("formats %j as %s", (baseFrequencyMhz, expected) => {
    expect(formatBaseFrequency(baseFrequencyMhz)).toBe(expected);
  });
});

describe(formatCpuDetails.name, () => {
  it("joins the generation and the base frequency", () => {
    expect(formatCpuDetails({ generation: "Haswell", isVirtual: false, baseFrequencyMhz: 2600 })).toBe("Haswell · 2.60 GHz");
  });

  it("leaves the base frequency out when the name carries none", () => {
    expect(formatCpuDetails({ generation: null, isVirtual: false, baseFrequencyMhz: null })).toBe("Unknown");
  });
});

describe(formatUnreportedNodesNote.name, () => {
  it.each([
    [1, "1 node doesn't report a CPU model, and a deployment can land on it."],
    [3, "3 nodes don't report a CPU model, and a deployment can land on them."]
  ])("formats %j nodes as %j", (unreportedNodeCount, expected) => {
    expect(formatUnreportedNodesNote(unreportedNodeCount)).toBe(expected);
  });
});
