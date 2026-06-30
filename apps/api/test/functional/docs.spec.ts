import { describe, expect, it, vi } from "vitest";

import { app } from "@src/rest-app";

describe("API Docs", () => {
  describe("GET /v1/doc", () => {
    it(`returns docs with all routes expected`, async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-07-03T12:00:00.000Z"));

      const response = await app.request(`/v1/doc?scope=console`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchSnapshot();

      vi.useRealTimers();
    });
  });
});
