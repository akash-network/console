import { describe, expect, it, vi } from "vitest";

import { app } from "@src/rest-app";

const BLOCKCHAIN_WORDING = /\b(blockchain|on[- ]?chain|the chain|broadcast\w*)\b/i;

describe("API Docs", () => {
  describe("GET /v1/doc", () => {
    it(`returns docs with all routes expected`, async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-07-03T12:00:00.000Z"));

      const response = await app.request(`/v1/doc?scope=console`);
      const data = await response.json();
      vi.useRealTimers();

      expect(response.status).toBe(200);
      expect(data).toMatchSnapshot();
    });

    it("describes routes without blockchain wording", async () => {
      const response = await app.request(`/v1/doc?scope=console`);

      const blockchainWorded = collectSummariesAndDescriptions(await response.json()).filter(text => BLOCKCHAIN_WORDING.test(text));

      expect([...new Set(blockchainWorded)]).toEqual([]);
    });
  });

  function collectSummariesAndDescriptions(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(collectSummariesAndDescriptions);
    if (!node || typeof node !== "object") return [];

    return Object.entries(node).flatMap(([key, value]) =>
      (key === "summary" || key === "description") && typeof value === "string" ? [value] : collectSummariesAndDescriptions(value)
    );
  }
});
