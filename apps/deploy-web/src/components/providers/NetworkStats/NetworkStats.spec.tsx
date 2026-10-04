import { describe, expect, it } from "vitest";

import type { NetworkStats as NetworkStatsData } from "@src/components/providers/ProvidersExplorer/useProvidersExplorerModel";
import { NetworkStats } from "./NetworkStats";

import { render, screen } from "@testing-library/react";

describe("NetworkStats", () => {
  it("shows free GPUs, the average uptime and the active leases", () => {
    setup({ availableGpuCount: 1234, activeProviderCount: 59, availableVcpuCount: 8868, averageUptime30d: 0.94521, activeLeaseCount: 678 });

    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("59 providers · 8.9K vCPU free")).toBeInTheDocument();
    expect(screen.getByText("94.52%")).toBeInTheDocument();
    expect(screen.getByText("678")).toBeInTheDocument();
  });

  it("shows placeholders while the numbers load", () => {
    setup({ availableGpuCount: null, activeProviderCount: null, availableVcpuCount: null, averageUptime30d: null, activeLeaseCount: null });

    expect(screen.getByLabelText("Loading gpus available")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading avg uptime (30d)")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading running now")).toBeInTheDocument();
    expect(screen.queryByText(/vCPU free/)).not.toBeInTheDocument();
  });

  function setup(stats: NetworkStatsData) {
    return render(<NetworkStats stats={stats} layout="column" />);
  }
});
