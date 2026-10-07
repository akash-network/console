import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import type { DEPENDENCIES } from "./useCloseDeployments";
import { useCloseDeployments } from "./useCloseDeployments";

import { renderHook } from "@testing-library/react";

const BATCH_ID = "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c";
const ACCEPTED = { data: { activityId: "b6f2d8e4-0f7c-4b37-9b52-6a1f0d3c2e11" } };

describe(useCloseDeployments.name, () => {
  describe("when the activity center is off", () => {
    it("signs one transaction closing every deployment and reports them closed once it lands", async () => {
      const { result, signAndBroadcastTx, requestClose } = setup({});

      expect(await result.current(["100", "101"])).toEqual({ closed: ["100", "101"], closing: [] });
      expect(signAndBroadcastTx).toHaveBeenCalledWith([
        TransactionMessageData.getCloseDeploymentMsg("akash1test", "100"),
        TransactionMessageData.getCloseDeploymentMsg("akash1test", "101")
      ]);
      expect(requestClose).not.toHaveBeenCalled();
    });

    it("closes from the wallet the user holds now", async () => {
      const { result, rerender, signAndBroadcastTx } = setup({});

      rerender({ address: "akash1switched" });
      await result.current(["100"]);

      expect(signAndBroadcastTx).toHaveBeenCalledWith([TransactionMessageData.getCloseDeploymentMsg("akash1switched", "100")]);
    });

    it("reports none of them closed when the transaction does not land", async () => {
      const { result } = setup({ txResponse: undefined });

      expect(await result.current(["100", "101"])).toEqual({ closed: [], closing: [] });
    });
  });

  describe("when the activity center is on", () => {
    it("hands each close to the background under one bulk close and reports them closing", async () => {
      const { result, requestClose, signAndBroadcastTx, sendCloseBatch, queryClient } = setup({ isActivityCenterOn: true });

      expect(await result.current(["100", "101"])).toEqual({ closed: [], closing: ["100", "101"] });
      expect(sendCloseBatch).toHaveBeenCalledTimes(1);
      expect(requestClose).toHaveBeenCalledWith({ dseq: "100", async: "true", batchId: BATCH_ID });
      expect(requestClose).toHaveBeenCalledWith({ dseq: "101", async: "true", batchId: BATCH_ID });
      expect(signAndBroadcastTx).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
    });

    it("sends every close before waiting on any of them", async () => {
      const { result, requestClose } = setup({ isActivityCenterOn: true, closeAnswers: { "100": "never" } });

      void result.current(["100", "101"]);

      await vi.waitFor(() => expect(requestClose).toHaveBeenCalledTimes(2));
    });

    it("reports a deployment closed when its close finished during the request", async () => {
      const { result } = setup({ isActivityCenterOn: true, closeAnswers: { "101": { data: { success: true } } } });

      expect(await result.current(["100", "101"])).toEqual({ closed: ["101"], closing: ["100"] });
    });

    it("tells the user how many closes were refused and why, and reports only the others", async () => {
      const refusal = new ApiError(402, { message: "Not enough credits to close this deployment" }, "DELETE /v1/deployments/101 → 402");
      const { result, enqueueSnackbar } = setup({ isActivityCenterOn: true, closeAnswers: { "101": refusal, "102": refusal } });

      expect(await result.current(["100", "101", "102"])).toEqual({ closed: [], closing: ["100"] });
      expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            title: "Couldn't close 2 deployments",
            subTitle: "Not enough credits to close this deployment",
            iconVariant: "error"
          })
        }),
        { variant: "error" }
      );
    });

    it("tells the user a single refused close apart from several", async () => {
      const { result, enqueueSnackbar } = setup({ isActivityCenterOn: true, closeAnswers: { "100": new Error("Failed to fetch") } });

      await result.current(["100"]);

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't close 1 deployment", subTitle: "Try again in a moment." }) }),
        { variant: "error" }
      );
    });

    it("tells the user nothing more when every close was accepted", async () => {
      const { result, enqueueSnackbar } = setup({ isActivityCenterOn: true });

      await result.current(["100", "101"]);

      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });
  });

  type CloseAnswer = { data: { activityId: string } | { success: boolean } } | Error | "never";

  function setup(input: { isActivityCenterOn?: boolean; txResponse?: unknown; closeAnswers?: Record<string, CloseAnswer> }) {
    const signAndBroadcastTx = vi.fn().mockResolvedValue("txResponse" in input ? input.txResponse : { transactionHash: "0x1" });
    const requestClose = vi.fn(async ({ dseq }: { dseq: string }) => {
      const answer = input.closeAnswers?.[dseq] ?? ACCEPTED;
      if (answer === "never") return new Promise(() => undefined);
      if (answer instanceof Error) throw answer;
      return answer;
    });
    const sendCloseBatch = vi.fn();
    const wallet = mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test", signAndBroadcastTx });
    const enqueueSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listActivities.getKey.mockReturnValue(["listActivities"]);
    api.v1.closeDeployment.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.closeDeployment.useMutation>>({ mutateAsync: requestClose as never }));

    const dependencies: typeof DEPENDENCIES = {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ api }),
      useWallet: () => wallet,
      useFlag: flag => flag === "notifications_activity_center" && !!input.isActivityCenterOn,
      useSendCloseBatch: () => async send => {
        sendCloseBatch();
        return await send(BATCH_ID);
      },
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
      useQueryClient: () => queryClient
    };

    const { result, rerender } = renderHook(
      ({ address }: { address: string }) => {
        wallet.address = address;
        return useCloseDeployments(dependencies);
      },
      { initialProps: { address: "akash1test" } }
    );

    return { result, rerender, signAndBroadcastTx, requestClose, sendCloseBatch, enqueueSnackbar, queryClient };
  }
});
