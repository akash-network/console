import nock from "nock";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenApiDocsService } from "@src/core/services/openapi-docs/openapi-docs.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";
import { openApiHonoHandlers } from "@src/routers/open-api-handlers";

const BLOCKCHAIN_WORDING = /\b(blockchain|on[- ]?chain|the chain|broadcast\w*)\b/i;
const NOTIFICATIONS_SWAGGER_PATH = fileURLToPath(new URL("../../../notifications/swagger/swagger.json", import.meta.url));
const WITHHELD_ROUTES = [
  "GET /v1/billing-details",
  "PUT /v1/billing-details",
  "POST /v1/stripe-webhook",
  "GET /v1/stripe/first-purchase-bonus",
  "POST /v1/stripe/coupons/apply",
  "GET /v1/stripe/prices",
  "POST /v1/stripe/payment-methods/setup",
  "GET /v1/stripe/payment-methods",
  "GET /v1/stripe/payment-methods/default",
  "POST /v1/stripe/payment-methods/default",
  "POST /v1/stripe/payment-methods/validate",
  "DELETE /v1/stripe/payment-methods/{paymentMethodId}",
  "GET /v1/stripe/transactions",
  "POST /v1/stripe/transactions/confirm",
  "GET /v1/stripe/transactions/export",
  "POST /v1/stripe/transactions/{id}/invoice"
];

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

    it("publishes every route but the withheld billing ones, the team and project routes included", async () => {
      const response = await app.request(`/v1/doc?scope=console`);
      const publishedRoutes = listRoutes((await response.json()) as OpenAPIObject);
      const everyRoute = listRoutes(
        await container.resolve(OpenApiDocsService).generateDocs(openApiHonoHandlers, { scope: "console", source: "http", includeHidden: true })
      );

      expect(everyRoute.filter(route => !publishedRoutes.includes(route)).sort()).toEqual([...WITHHELD_ROUTES].sort());
    });

    it("describes routes without blockchain wording, the merged notifications routes included", async () => {
      await serveNotificationsSwagger();

      const response = await app.request(`/v1/doc`);
      const docs = (await response.json()) as { paths: Record<string, unknown> };

      expect(Object.keys(docs.paths)).toContain("/v1/alerts");
      expect([...new Set(collectSummariesAndDescriptions(docs).filter(text => BLOCKCHAIN_WORDING.test(text)))]).toEqual([]);
    });
  });

  function listRoutes(docs: OpenAPIObject): string[] {
    return Object.entries(docs.paths).flatMap(([path, pathItem]) => Object.keys(pathItem ?? {}).map(method => `${method.toUpperCase()} ${path}`));
  }

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
