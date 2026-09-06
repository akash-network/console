import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { TxNotIncludedError, TxOutcomeUnknownError } from "../../lib/signing-client/tx-outcome.error";
import type { AppContext } from "../../types/app-context";
import type { ChainErrorService } from "../chain-error/chain-error.service";
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

  function setup() {
    const chainErrorService = mock<ChainErrorService>();
    const service = new HonoErrorHandlerService(chainErrorService);
    const context = mock<AppContext>({
      json: ((body: unknown, init: ResponseInit) => new Response(JSON.stringify(body), init)) as AppContext["json"]
    });

    return { service, context, chainErrorService };
  }
});
