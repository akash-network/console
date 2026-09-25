import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { PLACEMENT_OPTIONS_CONFIG } from "@src/placement-options/providers/config.provider";
import { app } from "@src/rest-app";

describe("Placement options API", () => {
  const { PROVIDER_INVENTORY_API_URL } = container.resolve(PLACEMENT_OPTIONS_CONFIG);

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /v1/placement-options", () => {
    it("answers with the options provider inventory reports", async () => {
      const options = {
        regions: ["eu-west", "na-us-west"],
        regionProviderCounts: { "eu-west": 2, "na-us-west": 5 },
        gpus: [
          {
            vendor: "nvidia",
            models: [{ name: "a100", memory: ["80Gi"], interface: ["sxm"], providerCount: 3, variants: [{ memory: null, interface: null, providerCount: 3 }] }]
          }
        ]
      };
      nock(PROVIDER_INVENTORY_API_URL).get("/v1/placement-options").reply(200, options);

      const response = await app.request("/v1/placement-options");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(options);
    });

    it("lets the answer be cached", async () => {
      nock(PROVIDER_INVENTORY_API_URL).get("/v1/placement-options").reply(200, { regions: [], gpus: [] });

      const response = await app.request("/v1/placement-options");

      expect(response.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=300");
    });

    it("passes an upstream failure through instead of reporting empty options", async () => {
      nock(PROVIDER_INVENTORY_API_URL).get("/v1/placement-options").reply(500, { error: "boom" });

      const response = await app.request("/v1/placement-options");

      expect(response.status).toBe(500);
    });

    it("answers 503 when provider inventory cannot be reached", async () => {
      nock(PROVIDER_INVENTORY_API_URL).get("/v1/placement-options").replyWithError("connection refused");

      const response = await app.request("/v1/placement-options");

      expect(response.status).toBe(503);
    });
  });
});
