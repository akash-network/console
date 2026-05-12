import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BidScreeningConfig } from "@src/bid-screening/config/env.config";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { BidScreeningRequest } from "../../http-schemas/bid-screening.schema";
import { BidScreeningController } from "./bid-screening.controller";

describe(BidScreeningController.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("screenProviders", () => {
    it("proxies the request to PROVIDER_INVENTORY_URL and returns its response", async () => {
      const providers = [{ owner: "akash1abc", hostUri: "https://provider.example.com:8443", region: "us-east", uptime7d: 0.998, isAudited: false }];
      const fetchSpy = mockFetchJson({ providers });
      const { controller } = setup({ providerInventoryApiUrl: "http://provider-inventory:3092" });

      const request = makeRequest();
      const result = await controller.screenProviders(request);

      expect(result).toEqual({ providers });
      const [url, init] = fetchSpy.mock.calls[0];
      expect((url as URL).toString()).toBe("http://provider-inventory:3092/v1/bid-screening");
      expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
      expect(JSON.parse(init?.body as string)).toEqual(request);
    });

    it("short-circuits to an empty list when the feature flag is disabled", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const { controller } = setup({ flagEnabled: false });

      const result = await controller.screenProviders(makeRequest());

      expect(result).toEqual({ providers: [] });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("throws when the proxy responds with a non-OK status", async () => {
      mockFetchError({ status: 502, statusText: "Bad Gateway" });
      const { controller } = setup({});

      await expect(controller.screenProviders(makeRequest())).rejects.toThrow(/Provider inventory bid-screening failed/);
    });
  });

  function setup(input: { flagEnabled?: boolean; providerInventoryApiUrl?: string }) {
    const featureFlagsService = mock<FeatureFlagsService>({
      isEnabled: () => input.flagEnabled ?? true
    });
    const config = mock<BidScreeningConfig>({
      PROVIDER_INVENTORY_API_URL: input.providerInventoryApiUrl ?? "http://provider-inventory:3000"
    });
    const controller = new BidScreeningController(featureFlagsService, config);
    return { controller, featureFlagsService, config };
  }
});

function mockFetchJson(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  );
}

function mockFetchError(input: { status: number; statusText: string }) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("", {
      status: input.status,
      statusText: input.statusText
    })
  );
}

function makeRequest(): BidScreeningRequest {
  return {
    name: "westcoast",
    requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] },
    resources: [
      {
        resource: {
          id: 1,
          cpu: { units: { val: "1000" }, attributes: [] },
          memory: { quantity: { val: "1073741824" }, attributes: [] },
          gpu: { units: { val: "0" }, attributes: [] },
          storage: [{ name: "default", quantity: { val: "5368709120" }, attributes: [{ key: "persistent", value: "false" }] }],
          endpoints: []
        },
        count: 1,
        price: { denom: "uakt", amount: "1000" }
      }
    ]
  };
}
