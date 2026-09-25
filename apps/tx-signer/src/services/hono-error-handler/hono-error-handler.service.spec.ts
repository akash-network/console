import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { TxNotIncludedError, TxOutcomeUnknownError } from "../../lib/signing-client/tx-outcome.error";
import { MessageExecutionFailedError } from "../../lib/signing-stargate-client-factory/message-execution-failed.error";
import { SimulationExpiredError } from "../../lib/signing-stargate-client-factory/simulation-expired.error";
import type { AppContext } from "../../types/app-context";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { HonoErrorHandlerService } from "./hono-error-handler.service";

describe(HonoErrorHandlerService.name, () => {
  it("returns 500 response for unknown errors", async () => {
    const { service, context } = setup();

    const response = await service.handle(new Error("boom"), context);
    expect(response.status).toBe(500);
  });

  it("returns chain error status when chain error service matches", async () => {
    const { service, context, chainErrorService } = setup();
    chainErrorService.getChainErrorStatus.mockReturnValue(402);

    const response = await service.handle(new Error("some chain error"), context);
    expect(response.status).toBe(402);
  });

  it("returns 500 when chain error service does not match", async () => {
    const { service, context, chainErrorService } = setup();
    chainErrorService.getChainErrorStatus.mockReturnValue(undefined);

    const response = await service.handle(new Error("unknown error"), context);
    expect(response.status).toBe(500);
  });

  it("carries a not-included transaction outcome and its hash into the response", async () => {
    const { service, context } = setup();

    const response = await service.handle(new TxNotIncludedError("ABC123"), context);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: "TxNotIncludedError", data: { outcome: "not_included", txHash: "ABC123" } });
  });

  it("carries an undecided transaction outcome and its hash into the response", async () => {
    const { service, context } = setup();

    const response = await service.handle(new TxOutcomeUnknownError("ABC123"), context);

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ error: "TxOutcomeUnknownError", data: { outcome: "unknown", txHash: "ABC123" } });
  });

  it("answers a transaction whose message the chain failed to execute with 400 and the chain's message verbatim", async () => {
    const { service, context } = setup();
    const chainMessage =
      "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: account not found [cosmos/cosmos-sdk@v0.53.6/baseapp/baseapp.go:1052] with gas used: '34881': unknown request";

    const response = await service.handle(new MessageExecutionFailedError(new Error(chainMessage)), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "BadRequestError", message: chainMessage, code: "bad_request", type: "client_error" });
  });

  it("keeps the status the chain error table gives a message the chain failed to execute", async () => {
    const { service, context } = setup({ chainErrorService: new ChainErrorService() });
    const chainMessage =
      "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Deposit invalid: insufficient balance [cosmos/cosmos-sdk@v0.53.3/baseapp/baseapp.go:1051] with gas used: '52906': unknown request";

    const response = await service.handle(new MessageExecutionFailedError(new Error(chainMessage)), context);

    expect(response.status).toBe(402);
  });

  it.each([
    {
      failure: "a sequence mismatch",
      error: new Error(
        "Query failed with (6): rpc error: code = Unknown desc = account sequence mismatch, expected 15533, got 15532: incorrect account sequence [cosmos/cosmos-sdk@v0.53.3/x/auth/ante/sigverify.go:364] with gas used: '19186': unknown request"
      ),
      status: 500
    },
    { failure: "a timeout", error: new DOMException("The operation was aborted due to timeout", "TimeoutError"), status: 500 },
    { failure: "an unreachable node", error: new Error("Bad status on response: 503"), status: 503 },
    {
      failure: "an expired simulation",
      error: new SimulationExpiredError(
        180_000,
        new Error("Query failed with (6): rpc error: code = Unknown desc = tx timeout with gas used: '0': unknown request")
      ),
      status: 500
    }
  ])("keeps answering $failure with $status", async ({ error, status }) => {
    const { service, context } = setup({ chainErrorService: new ChainErrorService() });

    const response = await service.handle(error, context);

    expect(response.status).toBe(status);
  });

  function setup(input?: { chainErrorService?: ChainErrorService }) {
    const chainErrorService = mock<ChainErrorService>();
    const service = new HonoErrorHandlerService(input?.chainErrorService ?? chainErrorService);
    const context = mock<AppContext>({
      json: ((body: unknown, init: ResponseInit) => new Response(JSON.stringify(body), init)) as AppContext["json"]
    });

    return { service, context, chainErrorService };
  }
});
