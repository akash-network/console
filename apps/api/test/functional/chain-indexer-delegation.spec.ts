import nock from "nock";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GetAddressTransactionsResponseSchema } from "@src/address/http-schemas/address.schema";
import { envSchema } from "@src/chain-indexer/config/env.config";
import { CHAIN_INDEXER_CONFIG } from "@src/chain-indexer/providers/chain-indexer-config.provider";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DashboardDataResponseSchema } from "@src/dashboard/http-schemas/dashboard-data/dashboard-data.schema";
import { app, initDb } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const CHAIN_INDEXER_URL = "http://chain-indexer.test";

container.register(CHAIN_INDEXER_CONFIG, { useValue: envSchema.parse({ CHAIN_INDEXER_API_BASE_URL: CHAIN_INDEXER_URL }) });

describe("Chain indexer delegation", () => {
  beforeAll(async () => {
    await initDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("GET /v1/addresses/{address}/transactions/{skip}/{limit}", () => {
    it("serves the legacy shape from chain-indexer while the flag is on", async () => {
      const { address } = setup({ flagOn: true });
      nock(CHAIN_INDEXER_URL)
        .get(`/v1/addresses/${address}/transactions`)
        .query({ skip: "0", limit: "2" })
        .reply(200, {
          data: {
            total: 3,
            transactions: [
              {
                height: 5457200,
                datetime: "2026-09-25T23:38:00.000Z",
                hash: "AB12",
                code: 0,
                gasUsed: 50,
                gasWanted: 70,
                fee: [{ denom: "uakt", amount: "1250" }],
                roles: ["signer"],
                messages: [{ index: 0, type: "/cosmos.bank.v1beta1.MsgSend" }]
              }
            ]
          }
        });

      const response = await app.request(`/v1/addresses/${address}/transactions/0/2`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(GetAddressTransactionsResponseSchema.parse(body)).toEqual(body);
      expect(body).toEqual({
        count: 3,
        results: [
          {
            height: 5457200,
            datetime: "2026-09-25T23:38:00.000Z",
            hash: "AB12",
            isSuccess: true,
            error: null,
            gasUsed: 50,
            gasWanted: 70,
            fee: 1250,
            memo: null,
            isSigner: true,
            messages: [{ id: "AB12-0", type: "/cosmos.bank.v1beta1.MsgSend", amount: 0, isReceiver: false }]
          }
        ]
      });
    });

    it("serves from the legacy indexer, without calling chain-indexer, while the flag is off", async () => {
      const { address } = setup({ flagOn: false });
      const chainIndexer = nock(CHAIN_INDEXER_URL).get(/.*/).reply(500);

      const response = await app.request(`/v1/addresses/${address}/transactions/0/2`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ count: 0, results: [] });
      expect(chainIndexer.isDone()).toBe(false);
    });
  });

  describe("GET /v1/dashboard-data", () => {
    it("serves the now and compare blocks from chain-indexer while the flag is on", async () => {
      setup({ flagOn: true });
      nock(CHAIN_INDEXER_URL)
        .get("/v1/network-stats")
        .query({ days: "3" })
        .reply(200, {
          data: {
            height: 5457211,
            datetime: "2026-09-25T23:39:08.746Z",
            activeLeaseCount: 12,
            totalLeaseCount: 1000,
            activeProviderCount: 5,
            active: { cpuUnits: 4000, gpuUnits: 2, memoryBytes: 8192, ephemeralStorageBytes: 4000, persistentStorageBytes: 96 },
            totalSpent: { uakt: "5000.000000000000000000", uusdc: "200", uact: "100" },
            daily: []
          }
        });

      const response = await app.request("/v1/dashboard-data");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(DashboardDataResponseSchema.parse(body)).toEqual(body);
      expect(body.now).toMatchObject({
        height: 5457211,
        activeLeaseCount: 12,
        totalLeaseCount: 1000,
        totalUAktSpent: 5000,
        totalUActSpent: 300,
        activeStorage: 4096
      });
      expect(body.compare.height).toBe(5457211);
    });

    it("serves the now and compare blocks from the legacy indexer while the flag is off", async () => {
      setup({ flagOn: false });
      const chainIndexer = nock(CHAIN_INDEXER_URL).get(/.*/).reply(500);

      const response = await app.request("/v1/dashboard-data");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.now.height).toBe(0);
      expect(chainIndexer.isDone()).toBe(false);
    });
  });

  function setup(input: { flagOn: boolean }) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(input.flagOn);
    const address = createAkashAddress();
    return { address };
  }
});
