import { describe, expect, it, vi } from "vitest";

import type { WorkspaceCtaState } from "./WorkspaceCtaButton";
import { WorkspaceCtaButton } from "./WorkspaceCtaButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(WorkspaceCtaButton.name, () => {
  it.each<[WorkspaceCtaState, string]>([
    ["requesting", "Requesting…"],
    ["select-providers", "Select providers to deploy"]
  ])("shows a disabled %s action", (state, name) => {
    setup({ state });

    expect(screen.getByRole("button", { name })).toBeDisabled();
  });

  it.each<[WorkspaceCtaState, string, "onDeploy" | "onRetry" | "onCloseAndEdit"]>([
    ["deploy", "Deploy", "onDeploy"],
    ["retry", "Retry", "onRetry"],
    ["close-and-edit", "Close and Edit", "onCloseAndEdit"]
  ])("runs the %s action", async (state, name, handler) => {
    const handlers = setup({ state });

    await userEvent.click(screen.getByRole("button", { name }));

    expect(handlers[handler]).toHaveBeenCalled();
  });

  function setup(input: { state: WorkspaceCtaState }) {
    const handlers = { onDeploy: vi.fn(), onRetry: vi.fn(), onCloseAndEdit: vi.fn() };
    render(<WorkspaceCtaButton state={input.state} {...handlers} />);
    return handlers;
  }
});
