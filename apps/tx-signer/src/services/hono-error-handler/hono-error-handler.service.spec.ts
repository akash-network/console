import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

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

  function setup() {
    const chainErrorService = mock<ChainErrorService>();
    const service = new HonoErrorHandlerService(chainErrorService);
    const context = mock<AppContext>({
      json: ((body: unknown, init: ResponseInit) => new Response(JSON.stringify(body), init)) as AppContext["json"]
    });

    return { service, context, chainErrorService };
  }
});
