import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentDangerZone } from "./DeploymentDangerZone";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDangerZone", () => {
  it("closes the deployment and notifies the parent on confirmation", async () => {
    const { onClosed, signAndBroadcastTx, closeDeploymentConfirm } = setup({ confirmed: true, txSucceeds: true });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    expect(closeDeploymentConfirm).toHaveBeenCalledWith(["1786440078202"]);
    await vi.waitFor(() => expect(signAndBroadcastTx).toHaveBeenCalled());
    expect(onClosed).toHaveBeenCalled();
  });

  it("does not broadcast when the user cancels the confirmation", async () => {
    const { onClosed, signAndBroadcastTx } = setup({ confirmed: false });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    expect(signAndBroadcastTx).not.toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("does not notify the parent when the transaction fails", async () => {
    const { onClosed, signAndBroadcastTx } = setup({ confirmed: true, txSucceeds: false });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(signAndBroadcastTx).toHaveBeenCalled());
    expect(onClosed).not.toHaveBeenCalled();
  });

  function setup(input: { confirmed?: boolean; txSucceeds?: boolean }) {
    const onClosed = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue(input.txSucceeds ?? true);
    const closeDeploymentConfirm = vi.fn().mockResolvedValue(input.confirmed ?? true);

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test", signAndBroadcastTx });
    const useManagedDeploymentConfirm: typeof DEPENDENCIES.useManagedDeploymentConfirm = () =>
      mock<ReturnType<typeof DEPENDENCIES.useManagedDeploymentConfirm>>({ closeDeploymentConfirm });

    const deployment = mock<DeploymentDto>({ dseq: "1786440078202", state: "active" });

    render(
      <DeploymentDangerZone
        deployment={deployment}
        onClosed={onClosed}
        dependencies={MockComponents(DEPENDENCIES, { useServices, useWallet, useManagedDeploymentConfirm })}
      />
    );

    return { onClosed, signAndBroadcastTx, closeDeploymentConfirm };
  }
});
