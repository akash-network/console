import { describe, expect, it } from "vitest";

import type { NetworkStats as NetworkStatsData } from "@src/components/providers/ProvidersExplorer/useProvidersExplorerModel";
import { NetworkStats } from "./NetworkStats";

import { render, screen } from "@testing-library/react";

describe("NetworkStats", () => {
  it("shows free GPUs, the average uptime and the active leases", () => {
    setup({ stats: createStats({}) });

    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("59 providers · 8.9K vCPU free")).toBeInTheDocument();
    expect(screen.getByText("94.52%")).toBeInTheDocument();
    expect(screen.getByText("678")).toBeInTheDocument();
  });

  it("pairs each stat with its value and its footnote", () => {
    setup({ stats: createStats({}) });

    expect(screen.getAllByRole("term").map(term => term.textContent)).toEqual(["GPUs available", "Avg uptime (30d)", "Running now"]);
    expect(screen.getAllByRole("definition").map(definition => definition.textContent)).toEqual([
      "1,234",
      "59 providers · 8.9K vCPU free",
      "94.52%",
      "Online providers, rolling 30 days",
      "678",
      "Active leases"
    ]);
  });

  it("shows placeholders while the numbers load", () => {
    setup({ stats: { availableGpuCount: null, activeProviderCount: null, availableVcpuCount: null, averageUptime30d: null, activeLeaseCount: null } });

    expect(screen.getByLabelText("Loading gpus available")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading avg uptime (30d)")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading running now")).toBeInTheDocument();
    expect(screen.queryByText(/vCPU free/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("definition")).toHaveLength(5);
  });

  it.each([
    ["the active providers", { activeProviderCount: null }],
    ["the free vCPUs", { availableVcpuCount: null }]
  ])("leaves out the GPU footnote until %s load", (_, missing) => {
    setup({ stats: createStats(missing) });

    expect(screen.queryByText(/providers ·/)).not.toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("stacks the stats in a column", () => {
    setup({ stats: createStats({}), layout: "column" });

    expect(screen.getByText("GPUs available").closest("dl")).toHaveClass("flex", "flex-col");
    expect(screen.getByText("GPUs available").closest("dl")).not.toHaveClass("grid");
  });

  it("lines the stats up in a row", () => {
    setup({ stats: createStats({}), layout: "row" });

    expect(screen.getByText("GPUs available").closest("dl")).toHaveClass("grid", "grid-cols-3");
    expect(screen.getByText("GPUs available").closest("dl")).not.toHaveClass("flex-col");
  });

  function createStats(overrides: Partial<NetworkStatsData>): NetworkStatsData {
    return { availableGpuCount: 1234, activeProviderCount: 59, availableVcpuCount: 8868, averageUptime30d: 0.94521, activeLeaseCount: 678, ...overrides };
  }

  function setup(input: { stats: NetworkStatsData; layout?: "column" | "row" }) {
    return render(<NetworkStats stats={input.stats} layout={input.layout ?? "column"} />);
  }
});
