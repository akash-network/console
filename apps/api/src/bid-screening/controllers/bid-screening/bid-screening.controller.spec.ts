import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { BidScreeningRequest } from "../../http-schemas/bid-screening.schema";
import type { BidScreeningService } from "../../services/bid-screening/bid-screening.service";
import { BidScreeningController } from "./bid-screening.controller";

describe(BidScreeningController.name, () => {
  describe("screenProviders", () => {
    it("returns providers wrapped in response object", async () => {
      const { controller, service } = setup();
      service.findMatchingProviders.mockResolvedValue([
        { owner: "akash1abc", hostUri: "https://provider.example.com:8443", region: "us-east", uptime7d: 0.998, isAudited: false }
      ]);

      const result = await controller.screenProviders(makeRequest());

      expect(result).toEqual({
        providers: [{ owner: "akash1abc", hostUri: "https://provider.example.com:8443", region: "us-east", uptime7d: 0.998, isAudited: false }]
      });
    });

    it("returns empty providers array when no matches", async () => {
      const { controller, service } = setup();
      service.findMatchingProviders.mockResolvedValue([]);

      const result = await controller.screenProviders(makeRequest());

      expect(result).toEqual({ providers: [] });
    });

    it("passes request to service", async () => {
      const { controller, service } = setup();
      service.findMatchingProviders.mockResolvedValue([]);
      const request = makeRequest();

      await controller.screenProviders(request);

      expect(service.findMatchingProviders).toHaveBeenCalledWith(request);
    });
  });

  function setup() {
    const service = mock<BidScreeningService>();
    const featureFlagsService = mock<FeatureFlagsService>({
      isEnabled: () => true
    });
    const controller = new BidScreeningController(service, featureFlagsService);
    return { controller, service, featureFlagsService };
  }
});

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
