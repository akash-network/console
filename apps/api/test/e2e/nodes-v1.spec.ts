import { netConfig } from "@akashnetwork/net";
import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

import { requestApi } from "@test/services/api-client";

describe.concurrent("Nodes API", () => {
  describe("GET /nodes/{network}", () => {
    it.each(["mainnet", "sandbox"])("should return %s node", async network => {
      const config = JSON.parse(await fs.readFile(path.join(__dirname, `../../../../config/${netConfig.mapped(network)}-nodes.json`), "utf8"));

      const { response: resInit, data: dataInit } = await requestApi(`/v1/nodes/${network}`);
      expect(resInit.status).toBe(200);
      expect(dataInit).toEqual(config);

      const { response: resCached, data: dataCached } = await requestApi(`/v1/nodes/${network}`);
      expect(resCached.status).toBe(200);
      expect(dataCached).toEqual(config);
    });

    it("throws 400 for an invalid network", async () => {
      const { response } = await requestApi("/v1/nodes/invalid-network", { returnNokOkResponse: true });
      expect(response.status).toBe(400);
    });
  });
});
