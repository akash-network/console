import { describe, expect, it } from "vitest";

import { ProviderSpecs } from "./ProviderSpecs";

import { render, screen } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";

describe(ProviderSpecs.name, () => {
  it("renders provider hardware and feature attributes", () => {
    render(
      <ProviderSpecs
        provider={{
          ...buildProvider({
            hardwareGpuVendor: "nvidia",
            hardwareCpu: "amd",
            hardwareMemory: "ddr5",
            hardwareCpuArch: "x86-64",
            hardwarePersistentStorageClass: "beta3",
            hardwareCuda: "12.7",
            datacenter: "us-southeast-atl-1",
            networkProvider: "level3",
            networkSpeedDown: 500,
            networkSpeedUp: 500,
            featPersistentStorage: true,
            featShm: true,
            gpuModels: [{ vendor: "nvidia", model: "rtx4090", ram: "24Gi", interface: "pcie" }]
          }),
          isOnline: true,
          isAudited: true,
          uptime: []
        }}
      />
    );

    expect(screen.getByText("GPU")).toBeInTheDocument();
    expect(screen.getByText("nvidia")).toBeInTheDocument();
    expect(screen.getByText("Shared Memory (SHM)")).toBeInTheDocument();
    expect(screen.getByText("Persistent Storage Class")).toBeInTheDocument();
    expect(screen.getByText("beta3")).toBeInTheDocument();
    expect(screen.getByText("CUDA")).toBeInTheDocument();
    expect(screen.getByText("12.7")).toBeInTheDocument();
    expect(screen.getByText("rtx4090 24Gi")).toBeInTheDocument();
  });
});
