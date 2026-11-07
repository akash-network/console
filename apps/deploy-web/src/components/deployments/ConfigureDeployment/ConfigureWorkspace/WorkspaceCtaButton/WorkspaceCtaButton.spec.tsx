import { CustomTooltip, TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import { AccountSpendGate as RealAccountSpendGate } from "@src/components/user/AccountActionGate/AccountActionGate";
import type { AccountStatus } from "@src/types/user";
import type { DEPENDENCIES, WorkspaceCtaState } from "./WorkspaceCtaButton";
import { WorkspaceCtaButton } from "./WorkspaceCtaButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildAccountStatus } from "@tests/seeders/accountStatus";

describe(WorkspaceCtaButton.name, () => {
  it.each<[WorkspaceCtaState, string]>([
    ["requesting", "Requesting…"],
    ["select-providers", "Select providers to deploy"],
    ["deploying", "Deploying…"]
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

  it.each<[WorkspaceCtaState, string]>([
    ["deploy", "Deploy"],
    ["retry", "Retry"]
  ])("is disabled with an explanation for a suspended user on the %s action", async (state, name) => {
    setup({ state, accountStatus: "suspended" });

    expect(screen.getByRole("button", { name })).toBeDisabled();
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Your account is suspended, so you can't deploy or add funds.");
  });

  function setup(input: { state: WorkspaceCtaState; accountStatus?: AccountStatus }) {
    const handlers = { onDeploy: vi.fn(), onRetry: vi.fn(), onCloseAndEdit: vi.fn() };
    const useAccountStatus = () => buildAccountStatus(input.accountStatus ?? "active");
    const AccountSpendGate: typeof DEPENDENCIES.AccountSpendGate = ({ children }) => (
      <RealAccountSpendGate dependencies={{ useAccountStatus, CustomTooltip }}>{children}</RealAccountSpendGate>
    );
    render(
      <TooltipProvider>
        <WorkspaceCtaButton state={input.state} {...handlers} dependencies={{ AccountSpendGate }} />
      </TooltipProvider>
    );
    return handlers;
  }
});
