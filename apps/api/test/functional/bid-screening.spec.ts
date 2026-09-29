import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { BID_SCREENING_CONFIG } from "@src/bid-screening/providers/config.provider";
import { app } from "@src/rest-app";

describe("Bid screening API", () => {
  const { PROVIDER_INVENTORY_API_URL } = container.resolve(BID_SCREENING_CONFIG);

  afterEach(() => {
    nock.cleanAll();
  });

  describe("POST /v1/bid-screening", () => {
    it("answers 503 when provider inventory cannot be reached", async () => {
      nock(PROVIDER_INVENTORY_API_URL).post("/v1/bid-screening").replyWithError("connection refused");

      const response = await screenProviders();

      expect(response.status).toBe(503);
    });

    it("answers 499 when the client disconnects before provider inventory answers", async () => {
      nock(PROVIDER_INVENTORY_API_URL).post("/v1/bid-screening").delay(1000).reply(200, { providers: [] });
      const clientConnection = new AbortController();

      const pendingResponse = screenProviders({ signal: clientConnection.signal });
      clientConnection.abort("Client connection prematurely closed.");
      const response = await pendingResponse;

      expect(response.status).toBe(499);
    });
  });

  function screenProviders(input?: { signal?: AbortSignal }) {
    return app.request("/v1/bid-screening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources: [], timezone: "UTC" }),
      signal: input?.signal
    });
  }
});
