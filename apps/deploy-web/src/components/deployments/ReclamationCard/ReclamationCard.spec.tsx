import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

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
    setup({ hasLocalManifest: true });

    expect(screen.getByRole("button", { name: "Close (recover escrow)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redeploy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /restart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
  });

  it("falls back to a 'new SDL' link when there is no local manifest", () => {
    setup({ hasLocalManifest: false });

    expect(screen.getByRole("link", { name: "Start from a new SDL" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("closes the deployment when confirmed", async () => {
    const closeDeploymentConfirm = vi.fn().mockResolvedValue(true);
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const onClosed = vi.fn();
    setup({ closeDeploymentConfirm, signAndBroadcastTx, onClosed });

    await userEvent.click(screen.getByRole("button", { name: "Close (recover escrow)" }));

    await waitFor(() => expect(signAndBroadcastTx).toHaveBeenCalled());
    expect(closeDeploymentConfirm).toHaveBeenCalledWith(["123"]);
    expect(onClosed).toHaveBeenCalled();
  });

  it("does not close when the confirmation is declined", async () => {
    const closeDeploymentConfirm = vi.fn().mockResolvedValue(false);
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    setup({ closeDeploymentConfirm, signAndBroadcastTx });

    await userEvent.click(screen.getByRole("button", { name: "Close (recover escrow)" }));

    await waitFor(() => expect(closeDeploymentConfirm).toHaveBeenCalled());
    expect(signAndBroadcastTx).not.toHaveBeenCalled();
  });

  function setup(
    input: {
      reason?: string;
      hasLocalManifest?: boolean;
      closeDeploymentConfirm?: ReturnType<typeof vi.fn>;
      signAndBroadcastTx?: ReturnType<typeof vi.fn>;
      onClosed?: () => void;
    } = {}
  ) {
    const signAndBroadcastTx = input.signAndBroadcastTx ?? vi.fn().mockResolvedValue(true);
    const closeDeploymentConfirm = input.closeDeploymentConfirm ?? vi.fn().mockResolvedValue(true);
    const push = vi.fn();

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1owner", signAndBroadcastTx });
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>({ closeDeploymentConfirm });
    const useLocalNotes: typeof DEPENDENCIES.useLocalNotes = () =>
      mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({
        getDeploymentData: vi.fn().mockReturnValue(input.hasLocalManifest ? { manifest: "version: 2.0" } : undefined)
      });
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });

    const lease = {
      id: "1",
      owner: "akash1owner",
      provider: "provider1",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: "closed",
      price: { denom: "uakt", amount: "100" },
      cpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0,
      reason: input.reason ?? "lease_closed_reason_unstable"
    } as LeaseDto;

    return render(
      <ReclamationCard
        lease={lease}
        dseq="123"
        onClosed={input.onClosed}
        dependencies={MockComponents(DEPENDENCIES, { useWallet, useManagedDeploymentConfirm, useLocalNotes, useRouter })}
      />
    );
  }
});
