import React from "react";
import { describe, expect, it } from "vitest";

import type { DeclaredGpuInterconnect } from "@src/utils/gpuInterconnect";
import { DEPENDENCIES, GpuInterconnectBadge } from "./GpuInterconnectBadge";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const TitleRenderingTooltip = ({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) => (
  <>
    {title}
    {children}
  </>
);

describe(GpuInterconnectBadge.name, () => {
  it("renders the bare label and explains interconnect when no fabric is pinned", () => {
    setup({ interconnect: { enabled: true, fabrics: [] }, dependencies: { CustomTooltip: TitleRenderingTooltip } });
    expect(screen.getByText("GPU Interconnect")).toBeInTheDocument();
    expect(screen.getByText(/high-bandwidth, low-latency RDMA/i)).toBeInTheDocument();
    expect(screen.getByText("Fabric: chosen by the provider.")).toBeInTheDocument();
  });

  it("reflects a single pinned fabric in the label", () => {
    setup({ interconnect: { enabled: true, fabrics: ["infiniband"] }, dependencies: { CustomTooltip: TitleRenderingTooltip } });
    expect(screen.getByText("GPU Interconnect (InfiniBand)")).toBeInTheDocument();
    expect(screen.getByText("Fabric: InfiniBand.")).toBeInTheDocument();
  });

  it("keeps a bare label and lists multiple pinned fabrics in the tooltip", () => {
    setup({ interconnect: { enabled: true, fabrics: ["infiniband", "roce"] }, dependencies: { CustomTooltip: TitleRenderingTooltip } });
    expect(screen.getByText("GPU Interconnect")).toBeInTheDocument();
    expect(screen.getByText("Fabrics: InfiniBand, RoCE.")).toBeInTheDocument();
  });

  it("shows a short label in compact mode and the full label in the tooltip", () => {
    setup({ interconnect: { enabled: true, fabrics: ["infiniband"] }, compact: true, dependencies: { CustomTooltip: TitleRenderingTooltip } });
    expect(screen.getByText("Interconnect")).toBeInTheDocument();
    expect(screen.getByText("GPU Interconnect (InfiniBand)")).toBeInTheDocument();
  });

  it("renders nothing when interconnect is not enabled", () => {
    setup({ interconnect: { enabled: false, fabrics: [] } });
    expect(screen.queryByText(/Interconnect/)).not.toBeInTheDocument();
  });

  function setup(input: { interconnect: DeclaredGpuInterconnect; compact?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    return render(
      <GpuInterconnectBadge interconnect={input.interconnect} compact={input.compact} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />
    );
  }
});
