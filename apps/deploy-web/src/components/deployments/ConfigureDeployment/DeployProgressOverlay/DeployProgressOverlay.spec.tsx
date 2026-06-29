import { describe, expect, it } from "vitest";

import { DEPENDENCIES, DeployProgressOverlay } from "./DeployProgressOverlay";

import { render, screen } from "@testing-library/react";

describe(DeployProgressOverlay.name, () => {
  it("renders the progress panel while deploying", () => {
    setup();
    expect(screen.getByText(/preparing deployment/i)).toBeInTheDocument();
  });

  it("completes the final phase once the deploy has succeeded", () => {
    setup({ activePhase: "success" });
    expect(screen.getByText(/deployment prepared/i)).toBeInTheDocument();
  });

  function setup(input: { activePhase?: "preparing" | "success" } = {}) {
    const ProvidersGlobe: typeof DEPENDENCIES.ProvidersGlobe = () => null;
    render(<DeployProgressOverlay activePhase={input.activePhase} dependencies={{ ...DEPENDENCIES, ProvidersGlobe }} />);
  }
});
