import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ClientProviderDetailWithStatus } from "@src/types/provider";
import { ProviderSpecs } from "./ProviderSpecs";

import { render, screen } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";

describe(ProviderSpecs.name, () => {
  it("shows the architectures the nodes report next to the declared one", () => {
    setup({ hardwareCpuArch: "x86-64", reportedCpuArchs: ["amd64", "arm64"], cpuArchAgreement: "match" });

    expect(screen.getByText("x86-64")).toBeInTheDocument();
    expect(screen.getByText("amd64")).toBeInTheDocument();
    expect(screen.getByText("arm64")).toBeInTheDocument();
    expect(screen.queryByText("Differs from the declared architecture")).not.toBeInTheDocument();
  });

  it("warns when the nodes contradict the declared architecture", () => {
    setup({ hardwareCpuArch: "x86-64", reportedCpuArchs: ["arm64"], cpuArchAgreement: "mismatch" });

    expect(screen.getByText("arm64")).toBeInTheDocument();
    expect(screen.getByText("Differs from the declared architecture")).toBeInTheDocument();
  });

  it("shows unknown instead of assuming amd64 when nothing is reported or declared", () => {
    setup({ hardwareCpuArch: "", reportedCpuArchs: [], cpuArchAgreement: "unknown" });

    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("amd64")).not.toBeInTheDocument();
  });

  function setup(overrides: Partial<Parameters<typeof buildProvider>[0]>) {
    const provider = mock<ClientProviderDetailWithStatus>(
      buildProvider({ hardwareGpuVendor: "nvidia", hardwareCpu: "epyc", hardwareMemory: "ddr5", ...overrides })
    );
    render(<ProviderSpecs provider={provider} />);
    return { provider };
  }
});
