import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import type { CloseOutcome } from "@src/hooks/useCloseDeployment/useCloseDeployment";
import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentDangerZone } from "./DeploymentDangerZone";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

const CLOSE_REASON: DeploymentCloseReasonInput = { closeReason: "cost_or_budget" };
const DSEQ = "1786440078202";

describe("DeploymentDangerZone", () => {
  it("confirms the close against this deployment and its name", async () => {
    const { confirmCloseDeployment, closeDeployment } = setup({ closeReason: CLOSE_REASON });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(closeDeployment).toHaveBeenCalledWith(DSEQ));
    expect(confirmCloseDeployment).toHaveBeenCalledWith({ dseqs: [DSEQ], name: "my-service" });
  });

  it("records why and refreshes the deployment once its close has landed", async () => {
    const { onClosed, recordCloseReason, analyticsService } = setup({ closeReason: CLOSE_REASON, outcome: "closed" });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(onClosed).toHaveBeenCalled());
    expect(recordCloseReason).toHaveBeenCalledWith([DSEQ], CLOSE_REASON);
    expect(analyticsService.track).toHaveBeenCalledWith("close_deployment", {
      category: "deployments",
      label: "Close deployment in deployment detail",
      reason: "cost_or_budget"
    });
  });

  it("records why but leaves the refresh to the activity host while the close runs in the background", async () => {
    const { onClosed, recordCloseReason, analyticsService } = setup({ closeReason: CLOSE_REASON, outcome: "closing" });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(recordCloseReason).toHaveBeenCalledWith([DSEQ], CLOSE_REASON));
    expect(analyticsService.track).toHaveBeenCalledWith("close_deployment", expect.objectContaining({ reason: "cost_or_budget" }));
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("records nothing and offers close again when the deployment did not close", async () => {
    const { onClosed, recordCloseReason, analyticsService, closeDeployment } = setup({ closeReason: CLOSE_REASON, outcome: "not_closed" });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(closeDeployment).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Close deployment" })).toBeEnabled());
    expect(recordCloseReason).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("closes nothing when the user cancels the confirmation", async () => {
    const { closeDeployment, confirmCloseDeployment } = setup({ closeReason: null });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(confirmCloseDeployment).toHaveBeenCalled());
    expect(closeDeployment).not.toHaveBeenCalled();
  });

  it("keeps close disabled while the request to close is on its way", async () => {
    setup({ closeReason: CLOSE_REASON, closeNeverAnswers: true });

    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Close deployment" })).toBeDisabled());
  });

  it("shows the deployment as closing and keeps close disabled while its close runs in the background", () => {
    setup({ closingDseqs: [DSEQ] });

    const button = screen.getByRole("button", { name: "Close deployment" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Closing…");
    expect(screen.getByText("This deployment is closing. You'll get a notification when it's done.")).toBeInTheDocument();
  });

  it("leaves close available while only other deployments are closing", () => {
    setup({ closingDseqs: ["42"] });

    const button = screen.getByRole("button", { name: "Close deployment" });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Close deployment");
    expect(screen.getByText("Stop all services and permanently tear down this deployment. This action can't be undone.")).toBeInTheDocument();
  });

  function setup(input: { closeReason?: DeploymentCloseReasonInput | null; outcome?: CloseOutcome; closeNeverAnswers?: boolean; closingDseqs?: string[] }) {
    const onClosed = vi.fn();
    const confirmCloseDeployment = vi.fn().mockResolvedValue(input.closeReason ?? null);
    const recordCloseReason = vi.fn();
    const closeDeployment = input.closeNeverAnswers
      ? vi.fn(() => new Promise<CloseOutcome>(() => undefined))
      : vi.fn(async () => input.outcome ?? ("closing" as const));

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useCloseDeploymentConfirm: typeof DEPENDENCIES.useCloseDeploymentConfirm = () => ({ confirmCloseDeployment, recordCloseReason });
    const useResolvedDeploymentName: typeof DEPENDENCIES.useResolvedDeploymentName = () => "my-service";
    const useClosingDeployments: typeof DEPENDENCIES.useClosingDeployments = () => new Set(input.closingDseqs ?? []);
    const useCloseDeployment: typeof DEPENDENCIES.useCloseDeployment = () => closeDeployment;

    render(
      <DeploymentDangerZone
        deployment={mock<DeploymentDto>({ dseq: DSEQ, state: "active" })}
        onClosed={onClosed}
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useCloseDeploymentConfirm,
          useResolvedDeploymentName,
          useClosingDeployments,
          useCloseDeployment
        })}
      />
    );

    return { onClosed, confirmCloseDeployment, recordCloseReason, analyticsService, closeDeployment };
  }
});
