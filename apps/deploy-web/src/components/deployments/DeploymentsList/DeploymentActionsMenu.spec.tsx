import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentActionsMenu } from "./DeploymentActionsMenu";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const CLOSE_REASON: DeploymentCloseReasonInput = { closeReason: "no_longer_needed" };

describe("DeploymentActionsMenu", () => {
  it("does not read the deployment definition until the menu is opened", async () => {
    const { useDeploymentDefinition } = setup({});

    expect(useDeploymentDefinition).toHaveBeenCalledWith(null, { acceptReferences: true });

    await openMenu();

    expect(useDeploymentDefinition).toHaveBeenLastCalledWith("100", { acceptReferences: true });
  });

  it("renames the deployment through the local note manager", async () => {
    const { changeDeploymentName } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Edit name/ }));

    expect(changeDeploymentName).toHaveBeenCalledWith("100");
  });

  it("redeploys from the resolved definition", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: '2.0'", name: "acme", source: "api" } });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: '2.0'", name: "acme", sourceDseq: expect.any(String) });
  });

  it("redeploys the values this browser gave back when it holds the running copy", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: '2.0' # withheld", restoredSdl: "version: '2.0' # restored", name: "acme", source: "api" } });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: '2.0' # restored", name: "acme", sourceDseq: expect.any(String) });
  });

  it("hides redeploy when no usable definition survives", async () => {
    setup({ definition: { sdl: undefined, name: undefined, source: "absent" } });

    await openMenu();

    expect(screen.queryByRole("menuitem", { name: /Redeploy/ })).not.toBeInTheDocument();
  });

  it("offers no close action for a deployment that is already closed", async () => {
    setup({ state: "closed" });

    await openMenu();

    expect(screen.queryByRole("menuitem", { name: /Close/ })).not.toBeInTheDocument();
  });

  it("shows close as already under way while the deployment's close runs in the background", async () => {
    const { confirmCloseDeployment } = setup({ isClosing: true });

    await openMenu();
    const closing = screen.getByRole("menuitem", { name: /Closing…/ });
    await userEvent.click(closing);

    expect(closing).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("menuitem", { name: /^Close$/ })).not.toBeInTheDocument();
    expect(confirmCloseDeployment).not.toHaveBeenCalled();
  });

  it("confirms against the deployment the reader opened, and no other", async () => {
    const { confirmCloseDeployment } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    expect(confirmCloseDeployment).toHaveBeenCalledWith({ dseqs: ["100"], name: "acme" });
  });

  it("signs a close for that deployment, records why, and tells the list to refresh once it lands", async () => {
    const { signAndBroadcastTx, onDeploymentClosed, recordCloseReason, analyticsService } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    await vi.waitFor(() => expect(onDeploymentClosed).toHaveBeenCalled());
    expect(signAndBroadcastTx).toHaveBeenCalledWith([
      expect.objectContaining({ value: expect.objectContaining({ id: { owner: "akash1owner", dseq: BigInt(100) } }) })
    ]);
    expect(recordCloseReason).toHaveBeenCalledWith(["100"], CLOSE_REASON);
    expect(analyticsService.track).toHaveBeenCalledWith("close_deployment", {
      category: "deployments",
      label: "Close deployment from list",
      reason: "no_longer_needed"
    });
  });

  it("leaves the list alone when the transaction does not land", async () => {
    const { signAndBroadcastTx, onDeploymentClosed, recordCloseReason, analyticsService } = setup({ broadcastResponse: undefined });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    await vi.waitFor(() => expect(signAndBroadcastTx).toHaveBeenCalled());
    expect(onDeploymentClosed).not.toHaveBeenCalled();
    expect(recordCloseReason).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("survives a close on an archived card that has nothing to refresh", async () => {
    const { signAndBroadcastTx } = setup({ onDeploymentClosed: undefined });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    await vi.waitFor(() => expect(signAndBroadcastTx).toHaveBeenCalled());
  });

  it("disables redeploy until the definition has resolved", async () => {
    setup({ definition: { sdl: undefined, name: undefined, source: "resolving" } });

    await openMenu();

    expect(screen.getByRole("menuitem", { name: /Redeploy/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("enables redeploy once the definition is usable", async () => {
    setup({ definition: { sdl: "version: '2.0'", name: "acme", source: "local" } });

    await openMenu();

    expect(screen.getByRole("menuitem", { name: /Redeploy/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("closes the menu before the confirmation opens, so the dialog is not trapped behind it", async () => {
    setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    await vi.waitFor(() => expect(screen.queryByRole("menuitem", { name: /Edit name/ })).not.toBeInTheDocument());
  });

  it("leaves the list alone when the close is not confirmed", async () => {
    const { signAndBroadcastTx, onDeploymentClosed, confirmCloseDeployment } = setup({ closeReason: null });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    await vi.waitFor(() => expect(confirmCloseDeployment).toHaveBeenCalled());
    expect(signAndBroadcastTx).not.toHaveBeenCalled();
    expect(onDeploymentClosed).not.toHaveBeenCalled();
  });

  async function openMenu() {
    await userEvent.click(screen.getByRole("button", { name: "Actions for deployment 100" }));
  }

  function setup(input: {
    state?: string;
    definition?: DeploymentDefinition;
    closeReason?: DeploymentCloseReasonInput | null;
    broadcastResponse?: unknown;
    onDeploymentClosed?: undefined;
    isClosing?: boolean;
  }) {
    const changeDeploymentName = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue("broadcastResponse" in input ? input.broadcastResponse : { transactionHash: "0x1" });
    const confirmCloseDeployment = vi.fn().mockResolvedValue("closeReason" in input ? input.closeReason : CLOSE_REASON);
    const recordCloseReason = vi.fn();
    const redeploy = vi.fn();
    const onDeploymentClosed = vi.fn();
    const analyticsService = mock<AnalyticsService>();

    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({ changeDeploymentName });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner", signAndBroadcastTx });
    const useDeploymentDefinition = vi.fn<typeof DEPENDENCIES.useDeploymentDefinition>(
      () => input.definition ?? { sdl: "version: '2.0'", name: "acme", source: "local" }
    );
    const useCloseDeploymentConfirm: typeof DEPENDENCIES.useCloseDeploymentConfirm = () => ({ confirmCloseDeployment, recordCloseReason });
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <DeploymentActionsMenu
          deployment={mock<DeploymentDto>({ dseq: "100", state: input.state ?? "active" })}
          onDeploymentClosed={"onDeploymentClosed" in input ? input.onDeploymentClosed : onDeploymentClosed}
          isClosing={input.isClosing}
          dependencies={MockComponents(DEPENDENCIES, { useLocalNotes, useWallet, useDeploymentDefinition, useCloseDeploymentConfirm, useRedeploy })}
        />
      </TestContainerProvider>
    );

    return {
      changeDeploymentName,
      signAndBroadcastTx,
      redeploy,
      onDeploymentClosed,
      useDeploymentDefinition,
      confirmCloseDeployment,
      recordCloseReason,
      analyticsService
    };
  }
});
