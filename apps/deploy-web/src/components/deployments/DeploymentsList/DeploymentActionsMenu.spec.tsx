import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentActionsMenu } from "./DeploymentActionsMenu";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentActionsMenu", () => {
  it("does not read the deployment definition until the menu is opened", async () => {
    const { useDeploymentDefinition } = setup({});

    expect(useDeploymentDefinition).toHaveBeenCalledWith(null);

    await openMenu();

    expect(useDeploymentDefinition).toHaveBeenLastCalledWith("100");
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

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: '2.0'", name: "acme" });
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

  it("signs a close and tells the list to refresh once it lands", async () => {
    const { signAndBroadcastTx, onDeploymentClosed } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    expect(signAndBroadcastTx).toHaveBeenCalled();
    await vi.waitFor(() => expect(onDeploymentClosed).toHaveBeenCalled());
  });

  it("leaves the list alone when the close is not confirmed", async () => {
    const { signAndBroadcastTx, onDeploymentClosed } = setup({ isCloseConfirmed: false });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: /Close/ }));

    expect(signAndBroadcastTx).not.toHaveBeenCalled();
    expect(onDeploymentClosed).not.toHaveBeenCalled();
  });

  async function openMenu() {
    await userEvent.click(screen.getByRole("button", { name: "Actions for deployment 100" }));
  }

  function setup(input: { state?: string; definition?: DeploymentDefinition; isCloseConfirmed?: boolean }) {
    const changeDeploymentName = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue({ transactionHash: "0x1" });
    const redeploy = vi.fn();
    const onDeploymentClosed = vi.fn();

    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({ changeDeploymentName });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner", signAndBroadcastTx });
    const useDeploymentDefinition = vi.fn<typeof DEPENDENCIES.useDeploymentDefinition>(
      () => input.definition ?? { sdl: "version: '2.0'", name: "acme", source: "local" }
    );
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>({
        closeDeploymentConfirm: vi.fn().mockResolvedValue(input.isCloseConfirmed ?? true)
      });
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;

    render(
      <DeploymentActionsMenu
        deployment={mock<DeploymentDto>({ dseq: "100", state: input.state ?? "active" })}
        onDeploymentClosed={onDeploymentClosed}
        dependencies={MockComponents(DEPENDENCIES, { useLocalNotes, useWallet, useDeploymentDefinition, useManagedDeploymentConfirm, useRedeploy })}
      />
    );

    return { changeDeploymentName, signAndBroadcastTx, redeploy, onDeploymentClosed, useDeploymentDefinition };
  }
});
