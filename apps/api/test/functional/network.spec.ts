import { app, initDb } from "@src/rest-app";

describe("Network API", () => {
  beforeAll(async () => {
    await initDb();
  });

  describe("GET /v1/nodes/{network}", () => {
    it("should return 404 for unsupported network", async () => {
      const res = await app.request("/v1/nodes/testnet");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toMatchObject({
        message: expect.stringContaining("not supported")
      });
    });

    it("should return 404 for unknown network", async () => {
      const res = await app.request("/v1/nodes/unknownnetwork");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toMatchObject({
        message: expect.stringContaining("not supported")
      });
    });
  });
});
