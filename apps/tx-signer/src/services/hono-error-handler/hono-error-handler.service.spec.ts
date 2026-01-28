import { mock } from "jest-mock-extended";

import type { AppContext } from "../../types/app-context";
import { HonoErrorHandlerService } from "./hono-error-handler.service";

describe(HonoErrorHandlerService.name, () => {
  it("returns 500 response for unknown errors", async () => {
    const service = new HonoErrorHandlerService();
    const context = mock<AppContext>({
      json: ((body: unknown, init: ResponseInit) => new Response(JSON.stringify(body), init)) as AppContext["json"]
    });

    const response = await service.handle(new Error("boom"), context);
    expect(response.status).toBe(500);
  });
});
