import type { PricingBody } from "@src/pricing/http-schemas/pricing.schema";
import { PricingService } from "./pricing.service";

describe(PricingService.name, () => {
  describe("getPricing", () => {
    it("calculates pricing for a single spec", async () => {
      const { service, specs } = setup({
        specs: { cpu: 1000, memory: 1000000000, storage: 1000000000 }
      });

      const result = await service.getPricing(specs);

      expect(result).toEqual({
        spec: { cpu: 1000, memory: 1000000000, storage: 1000000000 },
        akash: 5.83,
        aws: 32.82,
        azure: 39.37,
        gcp: 36.14
      });
    });

    it("calculates pricing for multiple specs", async () => {
      const { service, specs } = setup({
        specs: [
          { cpu: 2000, memory: 2000000000, storage: 2000000000 },
          { cpu: 3000, memory: 3000000000, storage: 3000000000 }
        ]
      });

      const result = await service.getPricing(specs);

      expect(result).toEqual([
        {
          spec: { cpu: 2000, memory: 2000000000, storage: 2000000000 },
          akash: 11.66,
          aws: 65.63,
          azure: 78.74,
          gcp: 72.29
        },
        {
          spec: { cpu: 3000, memory: 3000000000, storage: 3000000000 },
          akash: 17.49,
          aws: 98.45,
          azure: 118.11,
          gcp: 108.43
        }
      ]);
    });

    it("returns single object when input is single spec", async () => {
      const { service, specs } = setup({
        specs: { cpu: 500, memory: 500000000, storage: 500000000 }
      });

      const result = await service.getPricing(specs);

      expect(Array.isArray(result)).toBe(false);
      expect(result).toHaveProperty("spec");
    });

    it("returns array when input is array of specs", async () => {
      const { service, specs } = setup({
        specs: [{ cpu: 500, memory: 500000000, storage: 500000000 }]
      });

      const result = await service.getPricing(specs);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  function setup(input: { specs: PricingBody }) {
    const service = new PricingService();

    return {
      service,
      specs: input.specs
    };
  }
});
