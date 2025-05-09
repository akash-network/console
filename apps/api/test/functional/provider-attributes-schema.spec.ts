import { app } from "@src/app";

describe("ProviderAttributesSchema", () => {
  describe("GET /v1/provider-attributes-schema", () => {
    it("returns schema for provider attributes", async () => {
      const response = await app.request("/v1/provider-attributes-schema");

      const data = await response.json();

      expect(response.status).toBe(200);

      Object.keys(data).forEach(attributeName => {
        expect(data[attributeName].key).toEqual(expect.any(String));
        expect(data[attributeName].type).toEqual(expect.any(String));
        expect(data[attributeName].required).toEqual(expect.any(Boolean));
        expect(data[attributeName].description).toEqual(expect.any(String));
        if (data[attributeName].values) {
          expect(Array.isArray(data[attributeName].values)).toBe(true);
        }
      });
    });
  });
});
