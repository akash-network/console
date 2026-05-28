import type { TxHttpService, TxOutput } from "@akashnetwork/http-sdk";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { MESSAGE_STATES, signAndBroadcast, type SignAndBroadcastInput } from "./signAndBroadcast";

describe("signAndBroadcast", () => {
  it("calls txHttpService with userId and messages and returns true on success", async () => {
    const { input, txHttpService, analyticsService, showTransactionErrorSnackbar } = setup({
      txResult: { code: 0, transactionHash: "tx-hash", rawLog: "" }
    });

    const result = await signAndBroadcast(input);

    expect(result).toBe(true);
    expect(txHttpService.signAndBroadcastTx).toHaveBeenCalledWith({
      userId: "user-123",
      messages: input.msgs
    });
    expect(analyticsService.track).toHaveBeenCalledWith("successful_tx", expect.objectContaining({ category: "transactions" }));
    expect(showTransactionErrorSnackbar).not.toHaveBeenCalled();
  });

  it("sets loading state from MESSAGE_STATES when a known message type is present", async () => {
    const { input, setLoadingState } = setup({
      msgs: [{ typeUrl: "/akash.deployment.v1beta4.MsgCloseDeployment", value: new Uint8Array() }],
      txResult: { code: 0, transactionHash: "tx-hash", rawLog: "" }
    });

    await signAndBroadcast(input);

    expect(setLoadingState).toHaveBeenCalledWith(MESSAGE_STATES["/akash.deployment.v1beta4.MsgCloseDeployment"]);
  });

  it("skips setting a typed loading state when message type is unknown", async () => {
    const { input, setLoadingState } = setup({
      msgs: [{ typeUrl: "/akash.unknown.MsgFoo", value: new Uint8Array() }],
      txResult: { code: 0, transactionHash: "tx-hash", rawLog: "" }
    });

    await signAndBroadcast(input);

    expect(setLoadingState).not.toHaveBeenCalledWith(expect.stringMatching(/Deployment|creatingDeployment|searchingProviders/));
    expect(setLoadingState).toHaveBeenLastCalledWith(undefined);
  });

  it("returns false and surfaces the chain rawLog as the error message when txResult.code is non-zero", async () => {
    const { input, showTransactionErrorSnackbar, analyticsService } = setup({
      txResult: { code: 5, transactionHash: "", rawLog: "0uakt < 1000uakt: insufficient funds" }
    });

    const result = await signAndBroadcast(input);

    expect(result).toBe(false);
    expect(showTransactionErrorSnackbar).toHaveBeenCalledWith("Transaction has failed...", "0uakt < 1000uakt: insufficient funds");
    expect(analyticsService.track).toHaveBeenCalledWith("failed_tx", expect.objectContaining({ category: "transactions" }));
  });

  it("returns false and shows add-credits snackbar when txHttpService responds with HTTP 402", async () => {
    const { input, showAddCreditsSnackbar, showTransactionErrorSnackbar } = setup({
      txError: buildHttpError(402, "Out of credits: please top up your account")
    });

    const result = await signAndBroadcast(input);

    expect(result).toBe(false);
    expect(showAddCreditsSnackbar).toHaveBeenCalledWith("Out of credits", "please top up your account");
    expect(showTransactionErrorSnackbar).not.toHaveBeenCalled();
  });

  it("returns false and shows generic error snackbar on HTTP 400-class error", async () => {
    const { input, showTransactionErrorSnackbar, showAddCreditsSnackbar } = setup({
      txError: buildHttpError(400, "Validation failed: bad message")
    });

    const result = await signAndBroadcast(input);

    expect(result).toBe(false);
    expect(showTransactionErrorSnackbar).toHaveBeenCalledWith("Validation failed", "bad message");
    expect(showAddCreditsSnackbar).not.toHaveBeenCalled();
  });

  it("returns false and surfaces err.message on HTTP 5xx (treated like network error)", async () => {
    const { input, showTransactionErrorSnackbar, analyticsService } = setup({
      txError: buildHttpError(500, "Internal server error")
    });

    const result = await signAndBroadcast(input);

    expect(result).toBe(false);
    expect(showTransactionErrorSnackbar).toHaveBeenCalledWith("Transaction has failed...", "Internal server error");
    expect(analyticsService.track).toHaveBeenCalledWith("failed_tx", expect.objectContaining({ category: "transactions" }));
  });

  it("returns false and surfaces 'Transaction timeout' message when chain timeout error is thrown", async () => {
    const { input, showTransactionErrorSnackbar } = setup({
      txError: new Error("Tx was submitted but was not yet found on the chain after 30s")
    });

    const result = await signAndBroadcast(input);

    expect(result).toBe(false);
    expect(showTransactionErrorSnackbar).toHaveBeenCalledWith("Transaction has failed...", "Transaction timeout");
  });

  it("returns false when userId is missing without calling txHttpService", async () => {
    const { input, txHttpService, showTransactionErrorSnackbar } = setup({ userId: undefined });

    const result = await signAndBroadcast(input);

    expect(result).toBe(false);
    expect(txHttpService.signAndBroadcastTx).not.toHaveBeenCalled();
    expect(showTransactionErrorSnackbar).toHaveBeenCalledWith("Transaction has failed...", "Cannot broadcast transaction: user is not authenticated");
  });

  it("always refetches balances and resets loading state in finally", async () => {
    const { input, refetchBalances, setLoadingState } = setup({
      txError: new Error("boom")
    });

    await signAndBroadcast(input);

    expect(refetchBalances).toHaveBeenCalledTimes(1);
    expect(setLoadingState).toHaveBeenLastCalledWith(undefined);
  });

  function buildHttpError(status: number, message: string): AxiosError {
    const headers = new AxiosHeaders();
    const response = {
      data: { message },
      status,
      statusText: "",
      headers,
      config: { headers }
    } as AxiosResponse;
    const error = new AxiosError(message, String(status), { headers }, undefined, response);
    return error;
  }

  function setup(input?: { userId?: string; msgs?: SignAndBroadcastInput["msgs"]; txResult?: TxOutput; txError?: unknown }) {
    const txHttpService = mock<Pick<TxHttpService, "signAndBroadcastTx">>();
    if (input?.txError) {
      txHttpService.signAndBroadcastTx.mockRejectedValue(input.txError);
    } else if (input?.txResult) {
      txHttpService.signAndBroadcastTx.mockResolvedValue(input.txResult);
    }
    const analyticsService = mock<Pick<AnalyticsService, "track">>();
    const setLoadingState = vi.fn();
    const refetchBalances = vi.fn();
    const showAddCreditsSnackbar = vi.fn();
    const showTransactionErrorSnackbar = vi.fn();

    return {
      input: {
        userId: "userId" in (input ?? {}) ? input?.userId : "user-123",
        msgs: input?.msgs ?? [{ typeUrl: "/akash.market.v1beta5.MsgCreateLease", value: new Uint8Array() }],
        txHttpService,
        analyticsService,
        setLoadingState,
        refetchBalances,
        showAddCreditsSnackbar,
        showTransactionErrorSnackbar
      } satisfies SignAndBroadcastInput,
      txHttpService,
      analyticsService,
      setLoadingState,
      refetchBalances,
      showAddCreditsSnackbar,
      showTransactionErrorSnackbar
    };
  }
});
