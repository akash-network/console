import nock from "nock";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";

const BLOCKCHAIN_WORDING = /\b(blockchain|on[- ]?chain|the chain|broadcast\w*)\b/i;
const NOTIFICATIONS_SWAGGER_PATH = fileURLToPath(new URL("../../../notifications/swagger/swagger.json", import.meta.url));

describe("API Docs", () => {
  afterEach(() => {
    nock.cleanAll();
  });

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

    it("describes routes without blockchain wording, the merged notifications routes included", async () => {
      await serveNotificationsSwagger();

      const response = await app.request(`/v1/doc`);
      const docs = (await response.json()) as { paths: Record<string, unknown> };

      expect(Object.keys(docs.paths)).toContain("/v1/alerts");
      expect([...new Set(collectSummariesAndDescriptions(docs).filter(text => BLOCKCHAIN_WORDING.test(text)))]).toEqual([]);
    });
  });

  async function serveNotificationsSwagger() {
    const notificationsApiBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;

    nock(notificationsApiBaseUrl)
      .get("/api-json")
      .reply(200, JSON.parse(await readFile(NOTIFICATIONS_SWAGGER_PATH, "utf8")));
  }

  function collectSummariesAndDescriptions(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(collectSummariesAndDescriptions);
    if (!node || typeof node !== "object") return [];

    return Object.entries(node).flatMap(([key, value]) =>
      (key === "summary" || key === "description") && typeof value === "string" ? [value] : collectSummariesAndDescriptions(value)
    );
  }
});
