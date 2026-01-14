import { netConfig } from "@akashnetwork/net";
import fs from "fs/promises";
import path from "path";

import { apiClient } from "@test/services/api-client";

describe("Nodes API", () => {
  describe("GET /nodes/{network}", () => {
    it.each(["mainnet", "sandbox"])("should return %s node", async network => {
      const config = JSON.parse(await fs.readFile(path.join(__dirname, `../../../../config/${netConfig.mapped(network)}-nodes.json`), "utf8"));

      const resInit = await apiClient.get(`/v1/nodes/${network}`);
      expect(resInit.status).toBe(200);
      expect(resInit.data).toEqual(config);

      const resCached = await apiClient.get(`/v1/nodes/${network}`);
      expect(resCached.status).toBe(200);
      expect(resCached.data).toEqual(config);
    });

    it("throws 400 for an invalid network", async () => {
      const response = await apiClient.get("/v1/nodes/invalid-network");

      expect(response.status).toBe(400);
    });
  });
});
