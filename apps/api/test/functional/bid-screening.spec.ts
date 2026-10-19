import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { BID_SCREENING_CONFIG } from "@src/bid-screening/providers/config.provider";
import { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

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

    it("tells, for the gpu model requested, which providers are not bidding on Console's checks and when each last bid", async () => {
      const model = `h100-${faker.string.alphanumeric(8)}`;
      const [silent, bidding, unchecked] = [createAkashAddress(), createAkashAddress(), createAkashAddress()];
      await seedChecks({ model, silent, bidding });
      nock(PROVIDER_INVENTORY_API_URL)
        .post("/v1/bid-screening")
        .reply(200, { providers: [silent, bidding, unchecked].map(owner => ({ owner, hostUri: `https://${owner}:8443` })) });

      const response = await screenProviders({ body: aGpuRequest(`vendor/nvidia/model/${model}/ram/80Gi`) });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        providers: [
          { owner: silent, hostUri: `https://${silent}:8443`, isNotBidding: true, lastCheckBidAt: null },
          { owner: bidding, hostUri: `https://${bidding}:8443`, isNotBidding: false, lastCheckBidAt: expect.any(String) },
          { owner: unchecked, hostUri: `https://${unchecked}:8443`, isNotBidding: false, lastCheckBidAt: null }
        ]
      });
    });

    it("answers what provider inventory answers when the request asks for no gpu model", async () => {
      const screening = { providers: [{ owner: createAkashAddress(), hostUri: "https://provider:8443" }] };
      nock(PROVIDER_INVENTORY_API_URL).post("/v1/bid-screening").reply(200, screening);

      const response = await screenProviders({ body: aGpuRequest("vendor/nvidia/model/*") });

      expect(await response.json()).toEqual(screening);
    });

    it("answers what provider inventory answers when it refuses the request", async () => {
      nock(PROVIDER_INVENTORY_API_URL).post("/v1/bid-screening").reply(400, { error: "BadRequest", message: "Invalid request" });

      const response = await screenProviders({ body: aGpuRequest("vendor/nvidia/model/h100") });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "BadRequest", message: "Invalid request" });
    });
  });

  async function seedChecks(input: { model: string; silent: string; bidding: string }) {
    const checks = [1, 7, 13].map(hoursAgo => ({ dseq: faker.string.numeric(8), checkedAt: subHours(new Date(), hoursAgo) }));

    await container.resolve(GpuBidCheckRepository).insertMany(
      checks.flatMap(({ dseq, checkedAt }) =>
        [input.silent, input.bidding].map(provider => ({
          provider,
          vendor: "nvidia",
          model: input.model,
          source: "pricing-bot" as const,
          dseq,
          screened: true,
          bid: provider === input.bidding,
          checkedAt
        }))
      )
    );
  }

  function aGpuRequest(gpuKey: string) {
    return {
      timezone: "UTC",
      resources: [
        {
          resource: {
            id: 1,
            cpu: { units: { val: "1000" } },
            memory: { quantity: { val: "1073741824" } },
            gpu: { units: { val: "1" }, attributes: [{ key: gpuKey, value: "true" }] },
            storage: [{ name: "default", quantity: { val: "1073741824" } }]
          },
          count: 1,
          price: { denom: "uact", amount: "1000" }
        }
      ]
    };
  }

  function screenProviders(input?: { signal?: AbortSignal; body?: unknown }) {
    return app.request("/v1/bid-screening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input?.body ?? { resources: [], timezone: "UTC" }),
      signal: input?.signal
    });
  }
});
