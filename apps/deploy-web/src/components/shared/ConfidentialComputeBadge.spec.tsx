import React from "react";
import { describe, expect, it } from "vitest";

import type { TeeType } from "@src/utils/confidentialCompute";
import { ConfidentialComputeBadge, DEPENDENCIES } from "./ConfidentialComputeBadge";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const TitleRenderingTooltip = ({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) => (
  <>
    {title}
    {children}
  </>
);

describe(ConfidentialComputeBadge.name, () => {
  it("renders a friendly CPU label and the TEE explanation for a single cpu TEE type", () => {
    setup({ teeTypes: ["cpu"], dependencies: { CustomTooltip: TitleRenderingTooltip } });
    expect(screen.getByText("Confidential Compute (CPU)")).toBeInTheDocument();
    expect(screen.getByText(/Trusted Execution Environment/)).toBeInTheDocument();
    expect(screen.getByText(/depends on the provider honoring the request and passing attestation/i)).toBeInTheDocument();
  });

  it("renders a friendly CPU + GPU label for a single cpu-gpu TEE type", () => {
    setup({ teeTypes: ["cpu-gpu"], dependencies: { CustomTooltip: TitleRenderingTooltip } });
    expect(screen.getByText("Confidential Compute (CPU + GPU)")).toBeInTheDocument();
    expect(screen.getByText(/Trusted Execution Environment/)).toBeInTheDocument();
  });

  it("renders a typeless label and lists the distinct types in the tooltip for mixed deployments", () => {
    setup({ teeTypes: ["cpu", "cpu-gpu"], dependencies: { CustomTooltip: TitleRenderingTooltip } });

    expect(screen.getByText("Confidential Compute")).toBeInTheDocument();
    expect(screen.getByText(/CPU, CPU \+ GPU/)).toBeInTheDocument();
  });

  it("renders nothing when no TEE types are declared", () => {
    setup({ teeTypes: [] });
    expect(screen.queryByText(/Confidential Compute/)).not.toBeInTheDocument();
  });

  function setup(input: { teeTypes: TeeType[]; dependencies?: Partial<typeof DEPENDENCIES> }) {
    return render(<ConfidentialComputeBadge teeTypes={input.teeTypes} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
