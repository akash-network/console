import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { formatGpuMemory, getFreePercentage, GpuInventoryCard } from "./GpuInventoryCard";

import { render, screen, within } from "@testing-library/react";

describe("GpuInventoryCard", () => {
  it("lists each GPU model with its memory, interface and how many are free", () => {
    setup({
      models: [
        { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM5", total: 32, free: 4 },
        { vendor: "nvidia", model: "t4", ram: "16Gi", interface: "PCIe", total: 2, free: 0 }
      ],
      hasGpus: true
    });

    const table = screen.getByRole("table", { name: "GPU models" });
    expect(screen.getByText("4 of 34 free now")).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /H100 80 GB SXM5 4 of 32 free/ })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /T4 16 GB PCIe None free/ })).toBeInTheDocument();
    expect(screen.queryByText(/CPU and memory provider/)).not.toBeInTheDocument();
    expect(screen.queryByText("No inventory is reported while the provider is offline.")).not.toBeInTheDocument();
    expect(screen.queryByText("The GPU inventory can't be loaded right now.")).not.toBeInTheDocument();
  });

  it("flags a model with none free and keeps the others in the default tone", () => {
    setup({
      models: [
        { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM5", total: 32, free: 4 },
        { vendor: "nvidia", model: "t4", ram: "16Gi", interface: "PCIe", total: 2, free: 0 }
      ]
    });

    expect(screen.getByText("None free")).toHaveClass("text-amber-700");
    expect(screen.getByText("4 of 32 free")).toHaveClass("text-foreground");
  });

  it("keeps listing the GPUs an offline provider still reports", () => {
    setup({ models: [{ vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM5", total: 8, free: 8 }], isProviderOffline: true });

    expect(screen.getByRole("table", { name: "GPU models" })).toBeInTheDocument();
    expect(screen.queryByText("No inventory is reported while the provider is offline.")).not.toBeInTheDocument();
  });

  it("keeps a memory size it can't read as the provider reported it", () => {
    setup({ models: [{ vendor: "nvidia", model: "a100", ram: "lots", interface: "PCIe", total: 1, free: 1 }] });

    expect(screen.getByText("lots")).toBeInTheDocument();
  });

  it("shows the drivers seen on Console leases with the CUDA version each supports", () => {
    setup({
      models: [{ vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM5", total: 8, free: 8 }],
      drivers: [
        { driverVersion: "550.54.15", cudaVersion: "12.4", lastSeenDate: "2026-09-21" },
        { driverVersion: "470.10.01", cudaVersion: null, lastSeenDate: "2026-09-20" }
      ]
    });

    expect(screen.getByText("550.54.15 · CUDA 12.4")).toHaveAttribute("title", "Last seen 2026-09-21");
    expect(screen.getByText("470.10.01")).toBeInTheDocument();
    expect(screen.queryByText("None read yet")).not.toBeInTheDocument();
  });

  it("says when no driver has been read yet", () => {
    setup({ models: [{ vendor: "nvidia", model: "h100", ram: "80Gi", interface: "SXM5", total: 8, free: 8 }], drivers: [] });

    expect(screen.getByText("None read yet")).toBeInTheDocument();
  });

  it("says a provider without GPUs is a CPU provider and what it has free", () => {
    setup({ models: [], freeVcpuCount: 41, freeMemoryBytes: 96e9 });

    expect(screen.getByText("No GPUs. This is a CPU and memory provider, with 41 vCPU and 96 GB of RAM free right now.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/free now/)).not.toBeInTheDocument();
  });

  it("says an offline provider reports no inventory", () => {
    setup({ models: [], isProviderOffline: true });

    expect(screen.getByText("No inventory is reported while the provider is offline.")).toBeInTheDocument();
    expect(screen.queryByText(/CPU and memory provider/)).not.toBeInTheDocument();
  });

  it("says an offline GPU provider reports no inventory rather than that it can't be loaded", () => {
    setup({ models: [], isProviderOffline: true, hasGpus: true });

    expect(screen.getByText("No inventory is reported while the provider is offline.")).toBeInTheDocument();
    expect(screen.queryByText("The GPU inventory can't be loaded right now.")).not.toBeInTheDocument();
  });

  it.each([{ isProviderOffline: true }, { isProviderOffline: false }])(
    "shows only placeholders while the inventory loads (offline: $isProviderOffline)",
    ({ isProviderOffline }) => {
      setup({ models: [], isLoading: true, isProviderOffline });

      expect(screen.getByLabelText("Loading the GPU inventory")).toBeInTheDocument();
      expect(screen.queryByText("No inventory is reported while the provider is offline.")).not.toBeInTheDocument();
      expect(screen.queryByText(/CPU and memory provider/)).not.toBeInTheDocument();
    }
  );

  it("shows placeholders while the inventory loads", () => {
    setup({ models: null, isLoading: true });

    expect(screen.getByLabelText("Loading the GPU inventory")).toBeInTheDocument();
    expect(screen.queryByText("The GPU inventory can't be loaded right now.")).not.toBeInTheDocument();
  });

  it("says the inventory can't be loaded when the provider reports GPUs the inventory doesn't list yet", () => {
    setup({ models: [], hasGpus: true });

    expect(screen.getByText("The GPU inventory can't be loaded right now.")).toBeInTheDocument();
    expect(screen.queryByText(/No GPUs/)).not.toBeInTheDocument();
  });

  it("says when the inventory can't be loaded", () => {
    setup({ models: null, isLoading: false, isProviderOffline: true });

    expect(screen.getByText("The GPU inventory can't be loaded right now.")).toBeInTheDocument();
    expect(screen.queryByText(/free now/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CPU and memory provider/)).not.toBeInTheDocument();
    expect(screen.queryByText("No inventory is reported while the provider is offline.")).not.toBeInTheDocument();
  });

  describe(getFreePercentage.name, () => {
    it.each([
      [4, 32, 12.5],
      [0, 8, 0],
      [0, 0, 0]
    ])("reads %i free of %i as %d%", (free, total, percentage) => {
      expect(getFreePercentage(free, total)).toBe(percentage);
    });
  });

  describe(formatGpuMemory.name, () => {
    it.each([
      ["80Gi", "80 GB"],
      ["16GB", "16 GB"],
      ["80 Gi", "80 GB"],
      ["40.96Gi", "40.96 GB"],
      ["1.5ti", "1.5 TB"],
      [" 512Mi ", "512 MB"],
      ["80Gi ECC", "80Gi ECC"],
      ["~80Gi", "~80Gi"],
      ["lots", "lots"]
    ])("reads %j as %j", (ram, label) => {
      expect(formatGpuMemory(ram)).toBe(label);
    });
  });

  function setup(input: Partial<ComponentProps<typeof GpuInventoryCard>> & Pick<ComponentProps<typeof GpuInventoryCard>, "models">) {
    render(<GpuInventoryCard isLoading={false} isProviderOffline={false} hasGpus={false} drivers={[]} freeVcpuCount={8} freeMemoryBytes={16e9} {...input} />);
  }
});
