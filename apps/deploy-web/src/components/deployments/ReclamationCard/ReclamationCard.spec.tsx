import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, ReclamationCard } from "./ReclamationCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("ReclamationCard", () => {
  it("shows the provider close reason as the title", () => {
    setup({ reason: "lease_closed_reason_unstable" });
    expect(screen.getByText("Closed by provider (workloads unstable)")).toBeInTheDocument();
  });

  it("offers Close + Redeploy and no restart control", () => {
    setup({ definition: { sdl: "version: 2.0" } });

    expect(screen.getByRole("button", { name: "Close & refund" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redeploy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /restart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
  });

  it("redeploys with the resolved sdl and name when Redeploy is clicked", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: 2.0", name: "my-app" } });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0", name: "my-app" });
  });

  it("redeploys from the api definition on a device holding no local copy", async () => {
    const { redeploy } = setup({ definition: { sdl: "version: 2.0 # from-the-api", name: undefined, source: "api" } });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0 # from-the-api", name: undefined });
  });

  it("falls back to a 'new SDL' link when neither source holds a definition", () => {
    setup({ definition: { sdl: undefined, source: "absent" } });

    expect(screen.getByRole("link", { name: "Start a new deployment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("offers Redeploy disabled rather than the link while the definition is resolving", () => {
    setup({ definition: { sdl: undefined, source: "resolving" } });

    expect(screen.getByRole("button", { name: "Redeploy" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Start a new deployment" })).not.toBeInTheDocument();
  });

  it("closes the deployment when confirmed", async () => {
    const onClosed = vi.fn();
    const { wallet, confirm } = setup({ isConfirmed: true, onClosed });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(wallet.signAndBroadcastTx).toHaveBeenCalled());
    expect(confirm.closeDeploymentConfirm).toHaveBeenCalledWith(["123"]);
    expect(onClosed).toHaveBeenCalled();
  });

  it("does not close when the confirmation is declined", async () => {
    const { wallet, confirm } = setup({ isConfirmed: false });

    await userEvent.click(screen.getByRole("button", { name: "Close & refund" }));

    await waitFor(() => expect(confirm.closeDeploymentConfirm).toHaveBeenCalled());
    expect(wallet.signAndBroadcastTx).not.toHaveBeenCalled();
  });

  function setup(input: { reason?: string; definition?: Partial<DeploymentDefinition>; isConfirmed?: boolean; onClosed?: () => void } = {}) {
    const wallet = mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner" });
    wallet.signAndBroadcastTx.mockResolvedValue(true);

    const confirm = mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>();
    confirm.closeDeploymentConfirm.mockResolvedValue(input.isConfirmed ?? true);

    const definition: DeploymentDefinition = { sdl: "version: 2.0", name: undefined, source: "local", ...input.definition };
    const redeploy = vi.fn();

    const useWallet: typeof DEPENDENCIES.useWallet = () => wallet;
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () => confirm;
    const useDeploymentDefinition: typeof DEPENDENCIES.useDeploymentDefinition = () => definition;
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";

    const lease = mock<LeaseDto>({
      id: "1",
      owner: "akash1owner",
      provider: "provider1",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: "closed",
      price: { denom: "uakt", amount: "100" },
      reason: input.reason ?? "lease_closed_reason_unstable"
    });

    render(
      <ReclamationCard
        lease={lease}
        dseq="123"
        onClosed={input.onClosed}
        dependencies={MockComponents(DEPENDENCIES, { useWallet, useManagedDeploymentConfirm, useDeploymentDefinition, useRedeploy, useNewDeploymentUrl })}
      />
    );

    return { wallet, confirm, redeploy };
  }
});
