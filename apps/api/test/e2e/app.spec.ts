import { describe, expect, it } from "vitest";

import { requestApi } from "@test/services/api-client";

describe.concurrent("app", () => {
  describe("GET /status", () => {
    it("returns app stats and meta", async () => {
      const { response: res, data } = await requestApi("/status");
      expect(res.status).toBe(200);
      expect(data).toMatchObject({
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
