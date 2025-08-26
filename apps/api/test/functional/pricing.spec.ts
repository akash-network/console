import { app } from "@src/rest-app";

describe("Pricing API", () => {
  describe("POST /v1/pricing", () => {
    [
      {
        name: "works for a single spec",
        specs: { cpu: 1000, memory: 1000000000, storage: 1000000000 },
        expected: {
          spec: { cpu: 1000, memory: 1000000000, storage: 1000000000 },
          akash: 5.83,
          aws: 32.82,
          azure: 39.37,
          gcp: 36.14
        }
      },
      {
        name: "works for multiple specs",
        specs: [
          { cpu: 2000, memory: 2000000000, storage: 2000000000 },
          { cpu: 3000, memory: 3000000000, storage: 3000000000 }
        ],
        expected: [
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
        ]
      }
    ].forEach(({ name, specs, expected }) => {
      it(name, async () => {
        const response = await app.request("/v1/pricing", { method: "POST", body: JSON.stringify(specs) });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(expected);
      });
    });

    it("returns 400 for incomplete specs", async () => {
      const response = await app.request("/v1/pricing", { method: "POST", body: JSON.stringify({ cpu: 1 }) });

      expect(response.status).toBe(400);
    });

    it("returns 400 for specs with invalid values", async () => {
      const response = await app.request("/v1/pricing", { method: "POST", body: JSON.stringify({ cpu: "a", memory: "b", storage: "c" }) });

      expect(response.status).toBe(400);
    });

    it("returns 400 for specs with negative values", async () => {
      const response = await app.request("/v1/pricing", { method: "POST", body: JSON.stringify({ cpu: -1, memory: 2, storage: 3 }) });

      expect(response.status).toBe(400);
    });
  });
});
