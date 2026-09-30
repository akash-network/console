import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentDangerZone } from "./DeploymentDangerZone";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

const CLOSE_REASON: DeploymentCloseReasonInput = { closeReason: "cost_or_budget" };

describe("DeploymentDangerZone", () => {
  it("closes the deployment, records why, and notifies the parent", async () => {
    const { onClosed, signAndBroadcastTx, confirmCloseDeployment, recordCloseReason, analyticsService } = setup({
      closeReason: CLOSE_REASON,
      txSucceeds: true
    });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    expect(confirmCloseDeployment).toHaveBeenCalledWith({ dseqs: ["1786440078202"], name: "my-service" });
    await vi.waitFor(() => expect(onClosed).toHaveBeenCalled());
    expect(signAndBroadcastTx).toHaveBeenCalled();
    expect(recordCloseReason).toHaveBeenCalledWith(["1786440078202"], CLOSE_REASON);
    expect(analyticsService.track).toHaveBeenCalledWith("close_deployment", {
      category: "deployments",
      label: "Close deployment in deployment detail",
      reason: "cost_or_budget"
    });
  });

  it("does not broadcast when the user cancels the confirmation", async () => {
    const { onClosed, signAndBroadcastTx, confirmCloseDeployment } = setup({ closeReason: null });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(confirmCloseDeployment).toHaveBeenCalled());
    expect(signAndBroadcastTx).not.toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("records no reason and does not notify the parent when the transaction fails", async () => {
    const { onClosed, signAndBroadcastTx, recordCloseReason } = setup({ closeReason: CLOSE_REASON, txSucceeds: false });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(signAndBroadcastTx).toHaveBeenCalled());
    expect(recordCloseReason).not.toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
  });

  function setup(input: { closeReason: DeploymentCloseReasonInput | null; txSucceeds?: boolean }) {
    const onClosed = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue(input.txSucceeds ?? true);
    const confirmCloseDeployment = vi.fn().mockResolvedValue(input.closeReason);
    const recordCloseReason = vi.fn();

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test", signAndBroadcastTx });
    const useCloseDeploymentConfirm: typeof DEPENDENCIES.useCloseDeploymentConfirm = () => ({ confirmCloseDeployment, recordCloseReason });
    const useResolvedDeploymentName: typeof DEPENDENCIES.useResolvedDeploymentName = () => "my-service";

    const deployment = mock<DeploymentDto>({ dseq: "1786440078202", state: "active" });

    render(
      <DeploymentDangerZone
        deployment={deployment}
        onClosed={onClosed}
        dependencies={MockComponents(DEPENDENCIES, { useServices, useWallet, useCloseDeploymentConfirm, useResolvedDeploymentName })}
      />
    );

    return { onClosed, signAndBroadcastTx, confirmCloseDeployment, recordCloseReason, analyticsService };
  }
});
