import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./DeploymentsEmptyState";
import { DeploymentsEmptyState } from "./DeploymentsEmptyState";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(DeploymentsEmptyState.name, () => {
  it("invites a first deployment from an account that has never had one", () => {
    setup({});

    expect(screen.getByText("0 deployments on the supercloud")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deploy your first workload" })).toBeInTheDocument();
  });

  it("invites the next deployment from an account whose deployments are all closed", () => {
    setup({ hasDeployments: true });

    expect(screen.getByText("0 active deployments")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deploy your next workload" })).toBeInTheDocument();
  });

  it("offers templates to an account with nothing to go back to", () => {
    setup({ showTemplatesButton: true });

    expect(screen.getByRole("link", { name: "Browse templates" })).toBeInTheDocument();
  });

  it("leaves templates out for an account that has deployed before", () => {
    setup({ showTemplatesButton: false });

    expect(screen.queryByRole("link", { name: "Browse templates" })).not.toBeInTheDocument();
  });

  it("stages a new deployment when the link is taken", async () => {
    const { onDeployClick } = setup({});

    await userEvent.click(screen.getByRole("link", { name: /New deployment/ }));

    expect(onDeployClick).toHaveBeenCalled();
  });

  it("disables the New deployment link while the chain is down", () => {
    setup({ isBlockchainDown: true });

    expect(screen.getByRole("link", { name: /New deployment/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("leaves the New deployment link enabled while the chain is up", () => {
    setup({ isBlockchainDown: false });

    expect(screen.getByRole("link", { name: /New deployment/ })).toHaveAttribute("aria-disabled", "false");
  });

  it("keeps the staged SDL when the link is activated while the chain is down", () => {
    const { onDeployClick } = setup({ isBlockchainDown: true });

    const isNavigating = fireEvent.click(screen.getByRole("link", { name: /New deployment/ }));

    expect(onDeployClick).not.toHaveBeenCalled();
    expect(isNavigating).toBe(false);
  });

  function setup(input: { hasDeployments?: boolean; showTemplatesButton?: boolean; isBlockchainDown?: boolean }) {
    const onDeployClick = vi.fn();
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";
    const useBlockchainStatus: typeof DEPENDENCIES.useBlockchainStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: input.isBlockchainDown ?? false });

    render(
      <TestContainerProvider>
        <DeploymentsEmptyState
          onDeployClick={onDeployClick}
          hasDeployments={input.hasDeployments}
          showTemplatesButton={input.showTemplatesButton}
          dependencies={{ useNewDeploymentUrl, useBlockchainStatus }}
        />
      </TestContainerProvider>
    );

    return { ...input, onDeployClick };
  }
});
