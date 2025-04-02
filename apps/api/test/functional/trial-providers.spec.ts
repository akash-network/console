import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";
import { ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";

describe("Trial Providers", () => {
  beforeAll(async () => {
    await expect.getState().dbService.copyIndexerTables(["providerAttributeSignature"]);
    await initDb();
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /v1/trial-providers", () => {
    beforeAll(async () => {
      await ProviderAttributeSignature.create({
        provider: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh",
        auditor: AUDITOR,
        key: TRIAL_ATTRIBUTE,
        value: "true"
      });
    });

    it("returns a list of trial providers", async () => {
      const response = await app.request("/v1/trial-providers");

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(["akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh"]);
    });
  });
});
