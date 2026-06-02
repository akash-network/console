import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./ConfigureDeploymentPanes";
import { ConfigureDeploymentPanes } from "./ConfigureDeploymentPanes";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ConfigureDeploymentPanes", () => {
  it("marks the Deployment tab active by default", () => {
    setup();

    expect(screen.getByRole("button", { name: "1. Deployment" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "2. Configuration" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "3. Marketplace" })).not.toHaveAttribute("aria-current");
  });

  it("activates Configuration when its tab is clicked", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "2. Configuration" }));

    expect(screen.getByRole("button", { name: "1. Deployment" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "2. Configuration" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "3. Marketplace" })).not.toHaveAttribute("aria-current");
  });

  it("activates Marketplace when its tab is clicked", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "3. Marketplace" }));

    expect(screen.getByRole("button", { name: "1. Deployment" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "2. Configuration" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "3. Marketplace" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps only the active pane wrapper visible on mobile", async () => {
    setup();

    const deploymentRegion = screen.getByTestId("deployment-pane-mock").parentElement as HTMLElement;
    const configurationRegion = screen.getByTestId("configuration-pane-mock").parentElement as HTMLElement;
    const marketplaceRegion = screen.getByTestId("marketplace-pane-mock").parentElement as HTMLElement;

    expect(deploymentRegion).not.toHaveClass("hidden");
    expect(configurationRegion).toHaveClass("hidden");
    expect(marketplaceRegion).toHaveClass("hidden");

    await userEvent.click(screen.getByRole("button", { name: "3. Marketplace" }));

    expect(deploymentRegion).toHaveClass("hidden");
    expect(configurationRegion).toHaveClass("hidden");
    expect(marketplaceRegion).not.toHaveClass("hidden");
  });

  function setup() {
    const dependencies: typeof DEPENDENCIES = {
      DeploymentPane: vi.fn(() => <div data-testid="deployment-pane-mock" />),
      ConfigurationPane: vi.fn(() => <div data-testid="configuration-pane-mock" />),
      MarketplacePane: vi.fn(() => <div data-testid="marketplace-pane-mock" />)
    };
    return render(<ConfigureDeploymentPanes dependencies={dependencies} />);
  }
});
