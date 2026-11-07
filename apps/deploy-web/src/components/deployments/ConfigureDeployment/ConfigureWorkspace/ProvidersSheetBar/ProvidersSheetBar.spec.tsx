import { describe, expect, it, vi } from "vitest";

import type { AccountStatus } from "@src/types/user";
import type { DeploymentResourceSegment } from "../../DeploymentResourceSummary/deploymentResources";
import { ProvidersSheetBar } from "./ProvidersSheetBar";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { accountActionGatesFor } from "@tests/unit/accountActionGates";

describe(ProvidersSheetBar.name, () => {
  it("summarizes the deployment's resources on the button that shows the providers", () => {
    setup({
      segments: [
        { kind: "cpu", label: "1 vCPU" },
        { kind: "memory", label: "2 GB" },
        { kind: "storage", label: "1 GB" }
      ]
    });

    expect(screen.getByRole("button", { name: /show providers/i })).toHaveTextContent("Your deployment 1 vCPU · 2 GB · 1 GB Show providers");
  });

  it("asks to open the providers sheet from the summary", async () => {
    const { onSheetOpenChange } = setup({ isSheetOpen: false });

    await userEvent.click(screen.getByRole("button", { name: /show providers/i }));

    expect(onSheetOpenChange).toHaveBeenCalledWith(true);
  });

  it("shows the providers in a sheet while it is open", () => {
    setup({ isSheetOpen: true });

    expect(within(screen.getByRole("dialog", { name: "Providers" })).getByText("providers pane")).toBeInTheDocument();
  });

  it("keeps the providers out of the page while the sheet is closed", () => {
    setup({ isSheetOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("providers pane")).not.toBeInTheDocument();
  });

  it("asks to close the sheet from its handle", async () => {
    const { onSheetOpenChange } = setup({ isSheetOpen: true });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onSheetOpenChange).toHaveBeenCalledWith(false);
  });

  it("chooses a provider from the bar", async () => {
    const { onChooseProvider } = setup({ isChooseProviderDisabled: false });

    await userEvent.click(screen.getByRole("button", { name: "Choose a provider" }));

    expect(onChooseProvider).toHaveBeenCalled();
  });

  it("holds the provider choice while it is unavailable", () => {
    setup({ isChooseProviderDisabled: true });

    expect(screen.getByRole("button", { name: "Choose a provider" })).toBeDisabled();
  });

  it("keeps a suspended user from choosing a provider", async () => {
    const { onChooseProvider } = setup({ accountStatus: "suspended" });

    await userEvent.click(screen.getByRole("button", { name: /choose a provider/i }));

    expect(screen.getByRole("button", { name: /choose a provider/i })).toBeDisabled();
    expect(onChooseProvider).not.toHaveBeenCalled();
  });

  function setup(input: { segments?: DeploymentResourceSegment[]; isSheetOpen?: boolean; isChooseProviderDisabled?: boolean; accountStatus?: AccountStatus }) {
    const onSheetOpenChange = vi.fn();
    const onChooseProvider = vi.fn();
    render(
      <ProvidersSheetBar
        isSheetOpen={input.isSheetOpen ?? false}
        onSheetOpenChange={onSheetOpenChange}
        sheet={<p>providers pane</p>}
        isChooseProviderDisabled={input.isChooseProviderDisabled ?? false}
        onChooseProvider={onChooseProvider}
        dependencies={{
          useDeploymentResourceSummary: () => input.segments ?? [{ kind: "cpu", label: "1 vCPU" }],
          AccountSpendGate: accountActionGatesFor(input.accountStatus ?? "active").AccountSpendGate
        }}
      />
    );
    return { onSheetOpenChange, onChooseProvider };
  }
});
