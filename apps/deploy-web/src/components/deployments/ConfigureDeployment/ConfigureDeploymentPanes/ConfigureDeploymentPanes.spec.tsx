import { createStore, Provider as JotaiStoreProvider } from "jotai";
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

  it("does not render the SDL preview pane when the flag is disabled", () => {
    const { SdlPreviewPane } = setup({ isSdlPreviewEnabled: false });

    expect(SdlPreviewPane).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sdl-preview-pane-mock")).not.toBeInTheDocument();
  });

  it("renders the preview pane closed with the sdl when the flag is enabled", () => {
    const { SdlPreviewPane } = setup({ isSdlPreviewEnabled: true, sdl: 'version: "2.0"' });

    expect(SdlPreviewPane).toHaveBeenCalledWith(expect.objectContaining({ isOpen: false, sdl: 'version: "2.0"' }), expect.anything());
  });

  it("opens the preview pane when it requests opening and closes it back", async () => {
    const { SdlPreviewPane } = setup({ isSdlPreviewEnabled: true });

    await userEvent.click(screen.getByRole("button", { name: "Open SDL preview mock" }));
    expect(SdlPreviewPane).toHaveBeenLastCalledWith(expect.objectContaining({ isOpen: true }), expect.anything());

    await userEvent.click(screen.getByRole("button", { name: "Close SDL preview mock" }));
    expect(SdlPreviewPane).toHaveBeenLastCalledWith(expect.objectContaining({ isOpen: false }), expect.anything());
  });

  it("restores the open state from a previous session", async () => {
    const first = setup({ isSdlPreviewEnabled: true });
    await userEvent.click(screen.getByRole("button", { name: "Open SDL preview mock" }));
    first.unmount();

    const second = setup({ isSdlPreviewEnabled: true, preserveStorage: true });

    await vi.waitFor(() => {
      expect(second.SdlPreviewPane).toHaveBeenLastCalledWith(expect.objectContaining({ isOpen: true }), expect.anything());
    });
  });

  function setup(input: { isSdlPreviewEnabled?: boolean; sdl?: string; preserveStorage?: boolean } = {}) {
    const SdlPreviewPane = vi.fn(({ isOpen, onOpen, onClose }: { isOpen: boolean; onOpen: () => void; onClose: () => void }) => (
      <div data-testid="sdl-preview-pane-mock" data-open={isOpen}>
        <button type="button" aria-label="Open SDL preview mock" onClick={onOpen} />
        <button type="button" aria-label="Close SDL preview mock" onClick={onClose} />
      </div>
    ));
    const dependencies: typeof DEPENDENCIES = {
      DeploymentPane: vi.fn(() => <div data-testid="deployment-pane-mock" />),
      ConfigurationPane: vi.fn(() => <div data-testid="configuration-pane-mock" />),
      MarketplacePane: vi.fn(() => <div data-testid="marketplace-pane-mock" />),
      SdlPreviewPane: SdlPreviewPane as never,
      useFlag: (() => input.isSdlPreviewEnabled ?? false) as never
    };

    if (!input.preserveStorage) {
      localStorage.clear();
    }

    const { unmount } = render(
      <JotaiStoreProvider store={createStore()}>
        <ConfigureDeploymentPanes sdl={input.sdl ?? ""} dependencies={dependencies} />
      </JotaiStoreProvider>
    );

    return { SdlPreviewPane, unmount };
  }
});
