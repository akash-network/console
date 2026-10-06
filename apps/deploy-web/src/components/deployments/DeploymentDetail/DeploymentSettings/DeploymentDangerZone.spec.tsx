import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { DeploymentCloseReasonInput } from "@src/components/deployments/CloseDeploymentDialog/closeDeploymentReasons";
import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { DEPENDENCIES, DeploymentDangerZone } from "./DeploymentDangerZone";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

const CLOSE_REASON: DeploymentCloseReasonInput = { closeReason: "cost_or_budget" };
const DSEQ = "1786440078202";

describe("DeploymentDangerZone", () => {
  describe("when the activity center is off", () => {
    it("closes the deployment, records why, and notifies the parent", async () => {
      const { onClosed, signAndBroadcastTx, confirmCloseDeployment, recordCloseReason, analyticsService } = setup({
        closeReason: CLOSE_REASON,
        txSucceeds: true
      });

      await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

      expect(confirmCloseDeployment).toHaveBeenCalledWith({ dseqs: [DSEQ], name: "my-service" });
      await vi.waitFor(() => expect(onClosed).toHaveBeenCalled());
      expect(signAndBroadcastTx).toHaveBeenCalledWith([TransactionMessageData.getCloseDeploymentMsg("akash1test", DSEQ)]);
      expect(recordCloseReason).toHaveBeenCalledWith([DSEQ], CLOSE_REASON);
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
  });

  describe("when the activity center is on", () => {
    it("hands the close to the background instead of signing it in the browser, and records why", async () => {
      const { closeDeployment, signAndBroadcastTx, recordCloseReason, analyticsService, queryClient, onClosed } = setup({
        isActivityCenterOn: true,
        closeReason: CLOSE_REASON
      });

      await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

      await vi.waitFor(() => expect(recordCloseReason).toHaveBeenCalledWith([DSEQ], CLOSE_REASON));
      expect(closeDeployment).toHaveBeenCalledWith({ dseq: DSEQ, async: "true" });
      expect(signAndBroadcastTx).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith("close_deployment", {
        category: "deployments",
        label: "Close deployment in deployment detail",
        reason: "cost_or_budget"
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
      expect(onClosed).not.toHaveBeenCalled();
    });

    it("refreshes the deployment when the close finished during the request", async () => {
      const { onClosed, closeDeployment, signAndBroadcastTx } = setup({
        isActivityCenterOn: true,
        closeReason: CLOSE_REASON,
        closeResponse: { data: { success: true } }
      });

      await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

      await vi.waitFor(() => expect(onClosed).toHaveBeenCalled());
      expect(closeDeployment).toHaveBeenCalled();
      expect(signAndBroadcastTx).not.toHaveBeenCalled();
    });

    it("tells the user why the close was refused and records no reason", async () => {
      const refusal = new ApiError(402, { message: "Not enough credits to close this deployment" }, "DELETE /v1/deployments/1786440078202 → 402");
      const { enqueueSnackbar, recordCloseReason, analyticsService } = setup({ isActivityCenterOn: true, closeReason: CLOSE_REASON, closeRefusal: refusal });

      await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

      await vi.waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({
              title: "Couldn't close this deployment",
              subTitle: "Not enough credits to close this deployment",
              iconVariant: "error"
            })
          }),
          { variant: "error" }
        )
      );
      expect(recordCloseReason).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Close deployment" })).toBeEnabled();
    });

    it("asks the user to try again when a refusal carries no reason", async () => {
      const { enqueueSnackbar } = setup({ isActivityCenterOn: true, closeReason: CLOSE_REASON, closeRefusal: new Error("Failed to fetch") });

      await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

      await vi.waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try again in a moment." }) }), {
          variant: "error"
        })
      );
    });

    it("shows the deployment as closing and keeps close disabled while its close runs in the background", () => {
      setup({ isActivityCenterOn: true, closingDseqs: [DSEQ] });

      const button = screen.getByRole("button", { name: "Close deployment" });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("Closing…");
      expect(screen.getByText("This deployment is closing. You'll get a notification when it's done.")).toBeInTheDocument();
    });

    it("leaves close available while only other deployments are closing", () => {
      setup({ isActivityCenterOn: true, closingDseqs: ["42"] });

      const button = screen.getByRole("button", { name: "Close deployment" });
      expect(button).toBeEnabled();
      expect(button).toHaveTextContent("Close deployment");
      expect(screen.getByText("Stop all services and permanently tear down this deployment. This action can't be undone.")).toBeInTheDocument();
    });

    it("keeps close disabled while the request to close is on its way", async () => {
      setup({ isActivityCenterOn: true, closeReason: CLOSE_REASON, closeNeverAnswers: true });

      await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));

      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Close deployment" })).toBeDisabled());
    });
  });

  function setup(input: {
    isActivityCenterOn?: boolean;
    closeReason?: DeploymentCloseReasonInput | null;
    txSucceeds?: boolean;
    closeResponse?: { data: { activityId: string } | { success: boolean } };
    closeRefusal?: Error;
    closeNeverAnswers?: boolean;
    closingDseqs?: string[];
  }) {
    const onClosed = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue(input.txSucceeds ?? true);
    const confirmCloseDeployment = vi.fn().mockResolvedValue(input.closeReason ?? null);
    const recordCloseReason = vi.fn();
    const enqueueSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const closeDeployment = input.closeNeverAnswers
      ? vi.fn(() => new Promise(() => undefined))
      : input.closeRefusal
        ? vi.fn().mockRejectedValue(input.closeRefusal)
        : vi.fn().mockResolvedValue(input.closeResponse ?? { data: { activityId: "b6f2d8e4-0f7c-4b37-9b52-6a1f0d3c2e11" } });

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listActivities.getKey.mockReturnValue(["listActivities"]);
    api.v1.closeDeployment.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.closeDeployment.useMutation>>({ mutateAsync: closeDeployment as never }));

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService, api });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test", signAndBroadcastTx });
    const useCloseDeploymentConfirm: typeof DEPENDENCIES.useCloseDeploymentConfirm = () => ({ confirmCloseDeployment, recordCloseReason });
    const useResolvedDeploymentName: typeof DEPENDENCIES.useResolvedDeploymentName = () => "my-service";
    const useFlag: typeof DEPENDENCIES.useFlag = flag => flag === "notifications_activity_center" && !!input.isActivityCenterOn;
    const useClosingDeployments: typeof DEPENDENCIES.useClosingDeployments = () => new Set(input.closingDseqs ?? []);

    const deployment = mock<DeploymentDto>({ dseq: DSEQ, state: "active" });

    render(
      <DeploymentDangerZone
        deployment={deployment}
        onClosed={onClosed}
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useWallet,
          useCloseDeploymentConfirm,
          useResolvedDeploymentName,
          useFlag,
          useClosingDeployments,
          useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
          useQueryClient: () => queryClient
        })}
      />
    );

    return { onClosed, signAndBroadcastTx, confirmCloseDeployment, recordCloseReason, analyticsService, closeDeployment, queryClient, enqueueSnackbar };
  }
});
