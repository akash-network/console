import { createRoute, getCacheConfig } from "./create-route";

describe("create-route", () => {
  describe("getCacheConfig", () => {
    it("returns cache config for static paths", () => {
      createRoute({
        method: "get",
        path: "/v1/static-path",
        security: [],
        responses: { 200: { description: "OK" } },
        cache: { maxAge: 60 }
      });

      const config = getCacheConfig("/v1/static-path");
      expect(config).toEqual({ maxAge: 60 });
    });

    it("returns cache config when Hono :param format is used to lookup OpenAPI {param} format", () => {
      createRoute({
        method: "get",
        path: "/v1/nodes/{network}",
        security: [],
        responses: { 200: { description: "OK" } },
        cache: { maxAge: 120, staleWhileRevalidate: 60 }
      });

      // Hono's ctx.req.routePath returns :param format
      const config = getCacheConfig("/v1/nodes/:network");
      expect(config).toEqual({ maxAge: 120, staleWhileRevalidate: 60 });
    });

    it("handles multiple path parameters", () => {
      createRoute({
        method: "get",
        path: "/v1/providers/{provider}/deployments/{dseq}",
        security: [],
        responses: { 200: { description: "OK" } },
        cache: { maxAge: 300 }
      });

      // Hono format with multiple params
      const config = getCacheConfig("/v1/providers/:provider/deployments/:dseq");
      expect(config).toEqual({ maxAge: 300 });
    });

    it("returns undefined for paths without cache config", () => {
      const config = getCacheConfig("/v1/unknown-path");
      expect(config).toBeUndefined();
    });
  });
});
