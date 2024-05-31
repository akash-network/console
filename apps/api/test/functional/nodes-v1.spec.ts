import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";
import nock from "nock";
import { env } from "@src/utils/env";
import { NodeSeeder } from "@test/seeders/node-seeder";
import { faker } from "@faker-js/faker";
import mcache from "memory-cache";

describe("Nodes API", () => {
  const interceptor = nock(env.NODE_API_BASE_PATH);

  beforeAll(async () => {
    await initDb({ log: false });
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /nodes/*", () => {
    it.each(["mainnet", "sandbox", "testnet"])("should return %s node", async (network) => {
      const node = NodeSeeder.create();
      interceptor.get(`/cloudmos/main/config/${network}-nodes.json`).times(1).reply(200, node);

      const resInit = await app.request(`v1/nodes/${network}`);
      expect(resInit.status).toBe(200);
      expect(await resInit.json()).toMatchObject(node);

      const resCached = await app.request(`v1/nodes/${network}`);
      expect(resCached.status).toBe(200);
      expect(await resCached.json()).toMatchObject(node);
    });
  });

  describe("GET /version/*", () => {
    const PATH_REWRITE: Record<string, string> = {
      testnet: "testnet-02"
    };
    it.each(["mainnet", "sandbox", "testnet"])("should return %s node version", async (network) => {
      const version = `v${faker.number.int()}.${faker.number.int()}.${faker.number.int()}`;
      interceptor
        .get(`/net/master/${PATH_REWRITE[network] || network}/version.txt`)
        .times(1)
        .reply(200, version, {
          "Content-Type": "text/plain"
        });

      const resInit = await app.request(`v1/version/${network}`);
      expect(resInit.status).toBe(200);
      expect(await resInit.text()).toEqual(version);

      const resCached = await app.request(`v1/version/${network}`);
      expect(resCached.status).toBe(200);
      expect(await resCached.text()).toEqual(version);
    });
  });
});
