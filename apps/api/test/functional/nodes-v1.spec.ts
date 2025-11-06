import { netConfig } from "@akashnetwork/net";
import mcache from "memory-cache";
import nock from "nock";

import { closeConnections } from "@src/db/dbConnection";
import { app, initDb } from "@src/rest-app";
import { env } from "@src/utils/env";

import { NodeSeeder } from "@test/seeders/node.seeder";

describe("Nodes API", () => {
  const interceptor = nock(env.NODE_API_BASE_PATH);

  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /nodes/{network}", () => {
    it.each(["mainnet", "sandbox"])("should return %s node", async network => {
      const node = NodeSeeder.create();
      interceptor
        .get(`/console/main/config/${netConfig.mapped(network)}-nodes.json`)
        .times(1)
        .reply(200, node);

      const resInit = await app.request(`/v1/nodes/${network}`);
      expect(resInit.status).toBe(200);
      expect(await resInit.json()).toMatchObject(node);

      const resCached = await app.request(`/v1/nodes/${network}`);
      expect(resCached.status).toBe(200);
      expect(await resCached.json()).toMatchObject(node);
    });

    it("throws 400 for an invalid network", async () => {
      const response = await app.request("/v1/nodes/invalid-network");

      expect(response.status).toBe(400);
    });
  });
});
