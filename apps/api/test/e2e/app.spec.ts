import { apiClient } from "@test/services/api-client";

describe("app", () => {
  describe("GET /status", () => {
    it("returns app stats and meta", async () => {
      const res = await apiClient.get("/status");
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        memory: {
          external: expect.stringMatching(/^[0-9.]+ (M|G)B$/),
          heapTotal: expect.stringMatching(/^[0-9.]+ (M|G)B$/),
          heapUsed: expect.stringMatching(/^[0-9.]+ (M|G)B$/),
          rss: expect.stringMatching(/^[0-9.]+ (M|G)B$/)
        },
        version: expect.stringMatching(/^[0-9]+.[0-9]+.[0-9]+(-beta\.[0-9]+)?$/)
      });
    });
  });
});
