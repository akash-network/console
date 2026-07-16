import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, ReclamationCard } from "./ReclamationCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

type DeploymentData = NonNullable<ReturnType<ReturnType<typeof DEPENDENCIES.useLocalNotes>["getDeploymentData"]>>;

describe("ReclamationCard", () => {
  it("shows the provider close reason as the title", () => {
    setup({ reason: "lease_closed_reason_unstable" });
    expect(screen.getByText("Closed by provider (workloads unstable)")).toBeInTheDocument();
  });

  it("offers Close + Redeploy and no restart control", () => {
    setup({ hasLocalManifest: true });

    expect(screen.getByRole("button", { name: "Close & refund" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redeploy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /restart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
  });

  it("redeploys with the stored sdl and name when Redeploy is clicked", async () => {
    const { redeploy } = setup({ hasLocalManifest: true, manifest: "version: 2.0", name: "my-app" });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0", name: "my-app" });
  });

  it("falls back to a 'new SDL' link when there is no local manifest", () => {
    setup({ hasLocalManifest: false });

    expect(screen.getByRole("link", { name: "Start a new deployment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
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

  function setup(input: { reason?: string; hasLocalManifest?: boolean; manifest?: string; name?: string; isConfirmed?: boolean; onClosed?: () => void } = {}) {
    const wallet = mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner" });
    wallet.signAndBroadcastTx.mockResolvedValue(true);

    const confirm = mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>();
    confirm.closeDeploymentConfirm.mockResolvedValue(input.isConfirmed ?? true);

    const localNotes = mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>();
    localNotes.getDeploymentData.mockReturnValue(
      input.hasLocalManifest ? mock<DeploymentData>({ manifest: input.manifest ?? "version: 2.0", name: input.name }) : null
    );

    const redeploy = vi.fn();

    const useWallet: typeof DEPENDENCIES.useWallet = () => wallet;
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () => confirm;
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () => localNotes;
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
        dependencies={MockComponents(DEPENDENCIES, { useWallet, useManagedDeploymentConfirm, useLocalNotes, useRedeploy, useNewDeploymentUrl })}
      />
    );

    return { wallet, confirm, redeploy };
  }
});
