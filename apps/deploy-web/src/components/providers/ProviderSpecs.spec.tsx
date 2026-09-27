import type React from "react";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ClientProviderDetailWithStatus } from "@src/types/provider";
import { DEPENDENCIES, ProviderSpecs } from "./ProviderSpecs";

import { render, screen } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";
import { MockComponents } from "@tests/unit/mocks";

const TitleRenderingTooltip = ({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) => (
  <>
    <span>{title}</span>
    {children}
  </>
);

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

  it("shows unknown instead of crashing on a response that predates the reported architectures", () => {
    setup({ hardwareCpuArch: "x86-64", reportedCpuArchs: undefined, cpuArchAgreement: undefined });

    expect(screen.getByText("x86-64")).toBeInTheDocument();
    expect(valueOf("CPU Architecture (reported)")).toHaveTextContent("Unknown");
  });

  it("shows each observed gpu driver with the cuda version it supports and when it was last seen", () => {
    setup({
      gpuDrivers: [
        { driverVersion: "550.54.15", cudaVersion: "12.4", lastSeenDate: "2026-09-21" },
        { driverVersion: "535.183.01", cudaVersion: "12.2", lastSeenDate: "2026-09-18" }
      ]
    });

    expect(screen.getByText("550.54.15 · CUDA 12.4")).toBeInTheDocument();
    expect(screen.getByText("535.183.01 · CUDA 12.2")).toBeInTheDocument();
    expect(screen.getByText("Last seen 2026-09-21 on a Console deployment")).toBeInTheDocument();
    expect(screen.getByText("Last seen 2026-09-18 on a Console deployment")).toBeInTheDocument();
  });

  it("shows only the driver version when its cuda version is unknown", () => {
    setup({ gpuDrivers: [{ driverVersion: "440.33.01", cudaVersion: null, lastSeenDate: "2026-09-21" }] });

    expect(screen.getByText("440.33.01")).toBeInTheDocument();
  });

  it("shows unknown when no gpu driver has been observed", () => {
    setup({ gpuDrivers: [] });

    expect(valueOf("GPU Driver (observed)")).toHaveTextContent("Unknown");
  });

  it("shows unknown instead of crashing on a response that predates the observed gpu drivers", () => {
    setup({ gpuDrivers: undefined });

    expect(valueOf("GPU Driver (observed)")).toHaveTextContent("Unknown");
  });

  function valueOf(label: string) {
    return screen.getByText(label).nextElementSibling;
  }

  function setup(overrides: Partial<Parameters<typeof buildProvider>[0]>) {
    const provider = mock<ClientProviderDetailWithStatus>(
      buildProvider({ hardwareGpuVendor: "nvidia", hardwareCpu: "epyc", hardwareMemory: "ddr5", ...overrides })
    );
    render(<ProviderSpecs provider={provider} dependencies={MockComponents(DEPENDENCIES, { CustomTooltip: TitleRenderingTooltip })} />);
    return { provider };
  }
});
