import React from "react";
import { describe, expect, it } from "vitest";

import type { TeeServiceCarveout } from "@src/utils/confidentialCompute";
import { ConfidentialComputeResources, DEPENDENCIES } from "./ConfidentialComputeResources";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

const MIB = 1024 * 1024;

const cpuCarveout: TeeServiceCarveout = {
  serviceName: "web",
  teeType: "cpu",
  requested: { cpu: 500, memory: 256 * MIB },
  reserved: { cpu: 100, memory: 64 * MIB },
  container: { cpu: 400, memory: 192 * MIB }
};

describe(ConfidentialComputeResources.name, () => {
  it("renders nothing when there are no carve-outs", () => {
    const { container } = setup({ carveouts: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the requested, sidecar and available rows with formatted values", () => {
    setup({ carveouts: [cpuCarveout] });

    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("Attestation sidecar")).toBeInTheDocument();
    expect(screen.getByText("Available to your container")).toBeInTheDocument();

    expect(screen.getByText("0.5 CPU")).toBeInTheDocument();
    expect(screen.getByText("256 MiB")).toBeInTheDocument();
    expect(screen.getByText("0.1 CPU")).toBeInTheDocument();
    expect(screen.getByText("64 MiB")).toBeInTheDocument();
    expect(screen.getByText("0.4 CPU")).toBeInTheDocument();
    expect(screen.getByText("192 MiB")).toBeInTheDocument();
  });

  it("warns when the declared resources are at or below the attestation sidecar reservation", () => {
    const constrained: TeeServiceCarveout = {
      serviceName: "web",
      teeType: "cpu",
      requested: { cpu: 100, memory: 64 * MIB },
      reserved: { cpu: 100, memory: 64 * MIB },
      container: { cpu: 10, memory: 16 * MIB }
    };
    setup({ carveouts: [constrained] });
    expect(screen.getByText(/minimum/i)).toBeInTheDocument();
  });

  it("does not warn when the declared resources comfortably exceed the reservation", () => {
    setup({ carveouts: [cpuCarveout] });
    expect(screen.queryByText(/minimum/i)).not.toBeInTheDocument();
  });

  it("labels each service when more than one declares a TEE type", () => {
    const second: TeeServiceCarveout = {
      ...cpuCarveout,
      serviceName: "api",
      teeType: "cpu-gpu",
      reserved: { cpu: 100, memory: 128 * MIB },
      container: { cpu: 400, memory: 128 * MIB }
    };
    setup({ carveouts: [cpuCarveout, second] });

    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("explains that billing is unaffected via the tooltip", () => {
    const CustomTooltip = ({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) => (
      <>
        {title}
        {children}
      </>
    );
    setup({ carveouts: [cpuCarveout], dependencies: { CustomTooltip } });

    expect(screen.getByText(/still pay for the full/i)).toBeInTheDocument();
  });

  function setup(input: { carveouts: TeeServiceCarveout[]; dependencies?: Partial<typeof DEPENDENCIES> }) {
    return render(<ConfidentialComputeResources carveouts={input.carveouts} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
