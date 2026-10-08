import { describe, expect, it, vi } from "vitest";

import type { DeployCtaState } from "../../deployCtaState/deployCtaState";
import { ConfigureWorkspaceHeader } from "./ConfigureWorkspaceHeader";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ConfigureWorkspaceHeader.name, () => {
  it("titles the page under the back control and summarizes the deployment's resources", () => {
    setup({ ctaState: "request-quotes" });

    expect(screen.getByText("back control")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Configure your deployment" })).toBeInTheDocument();
    expect(screen.getByText("In some instances, not all providers will submit a bid for your deployment.")).toBeInTheDocument();
    expect(screen.getByText("resource summary")).toBeInTheDocument();
  });

  it("offers no action while the deployment is configured, since providers are chosen from the availability panel", () => {
    setup({ ctaState: "request-quotes" });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the bid phase action beside the resources", () => {
    setup({ ctaState: "select-providers" });

    expect(screen.getByRole("button", { name: "Select providers to deploy" })).toBeDisabled();
  });

  it.each<[DeployCtaState, string, "onDeploy" | "onRetry" | "onCloseAndEdit"]>([
    ["deploy", "Deploy", "onDeploy"],
    ["retry", "Retry", "onRetry"],
    ["close-and-edit", "Close and Edit", "onCloseAndEdit"]
  ])("runs the %s action", async (ctaState, name, handler) => {
    const handlers = setup({ ctaState });

    await userEvent.click(screen.getByRole("button", { name }));

    expect(handlers[handler]).toHaveBeenCalled();
  });

  function setup(input: { ctaState: DeployCtaState }) {
    const handlers = { onDeploy: vi.fn(), onRetry: vi.fn(), onCloseAndEdit: vi.fn() };
    render(
      <ConfigureWorkspaceHeader
        backButton={<span>back control</span>}
        ctaState={input.ctaState}
        {...handlers}
        dependencies={{ DeploymentResourceSummary: () => <span>resource summary</span> }}
      />
    );
    return handlers;
  }
});
