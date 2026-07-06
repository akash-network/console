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

  it("titles the panel with the deployment name when one is provided", () => {
    setup({ deploymentName: "my-app" });
    expect(screen.getByRole("heading", { name: "Deploying my-app" })).toBeInTheDocument();
  });

  it("falls back to a generic title when no deployment name is provided", () => {
    setup({ deploymentName: "  " });
    expect(screen.getByRole("heading", { name: "Deploying your deployment" })).toBeInTheDocument();
  });

  it("trims surrounding whitespace from the deployment name in the title", () => {
    setup({ deploymentName: "  my-app  " });
    expect(screen.getByRole("heading", { name: "Deploying my-app" })).toBeInTheDocument();
  });

  function setup(input: { activePhase?: "preparing" | "success"; deploymentName?: string } = {}) {
    const ProvidersGlobe: typeof DEPENDENCIES.ProvidersGlobe = () => null;
    render(<DeployProgressOverlay activePhase={input.activePhase} deploymentName={input.deploymentName} dependencies={{ ...DEPENDENCIES, ProvidersGlobe }} />);
  }
});
