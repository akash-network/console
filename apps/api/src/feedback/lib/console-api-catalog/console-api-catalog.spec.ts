import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { describe, expect, it } from "vitest";

import {
  ASSISTANT_READABLE_ROUTES,
  consoleApiCatalogOf,
  type ConsoleApiRoute,
  consoleApiRoutesOf,
  isAssistantReadablePath,
  matchConsoleApiRoute,
  matchesRouteTemplate,
  publishedGetRoutesOf,
  readableConsoleApiRouteOf
} from "./console-api-catalog";

const BEARER = [{ BearerAuth: [] }];
const PROJECTS_SCHEMA = { type: "object", properties: { data: { type: "array" } } } as const;
const JSON_OK = { 200: { description: "ok", content: { "application/json": { schema: PROJECTS_SCHEMA } } } };

function documentOf(paths: OpenAPIObject["paths"]): OpenAPIObject {
  return { openapi: "3.0.0", info: { title: "Console API", version: "v1" }, paths };
}

function route(overrides: Partial<ConsoleApiRoute> & { path: string }): ConsoleApiRoute {
  return { tag: "Projects", summary: "", queryParameters: [], forSignedInUser: true, responseSchema: PROJECTS_SCHEMA, ...overrides };
}

const COMMITTED_DOCUMENT: OpenAPIObject = JSON.parse(readFileSync(resolve(__dirname, "../../../../swagger/openapi.json"), "utf8"));

const SENSITIVE_ROUTES = [
  "/v1/api-keys",
  "/v1/api-keys/{id}",
  "/v1/user/me",
  "/v1/user/byUsername/{username}",
  "/v1/user/checkUsernameAvailability/{username}",
  "/v1/user/me/deletion-eligibility",
  "/v1/organization-members",
  "/v1/organization-members/{id}/project-grants",
  "/v1/organization-invitations",
  "/v1/received-invitations",
  "/v1/organization-activities",
  "/v1/projects/{id}/members",
  "/v1/notification-channels",
  "/v1/notification-channels/{id}",
  "/v1/alerts",
  "/v1/alerts/{id}",
  "/v1/stripe/transactions",
  "/v1/stripe/transactions/export",
  "/v1/stripe/payment-methods",
  "/v1/stripe/payment-methods/default",
  "/v1/billing-details",
  "/v1/wallets",
  "/v1/wallet-settings",
  "/v1/fee-allowances",
  "/v1/sdl-secrets-context",
  "/v1/deployments/{dseq}",
  "/v1/deployment-settings/{userId}/{dseq}",
  "/v2/deployment-settings/{dseq}",
  "/v1/configure-drafts/{draftId}",
  "/v1/user/template/{id}",
  "/v1/user/templates/{username}",
  "/v1/assistant/consent"
];

describe("console-api-catalog", () => {
  describe("ASSISTANT_READABLE_ROUTES", () => {
    it("lists only routes the committed OpenAPI document publishes as GET with a JSON response schema", () => {
      const publishedGetPaths = publishedGetRoutesOf(COMMITTED_DOCUMENT)
        .filter(({ responseSchema }) => responseSchema)
        .map(({ path }) => path);

      expect([...ASSISTANT_READABLE_ROUTES].filter(path => !publishedGetPaths.includes(path))).toEqual([]);
    });

    it("lists none of the routes that answer with credentials, personal, contact, payment or teammate data", () => {
      expect(SENSITIVE_ROUTES.filter(path => ASSISTANT_READABLE_ROUTES.has(path))).toEqual([]);
    });
  });

  describe(publishedGetRoutesOf.name, () => {
    it("lists every published GET route with its tag, summary, query parameters, caller and response schema", () => {
      const document = documentOf({
        "/v1/projects": {
          get: {
            tags: ["Projects", "Organizations"],
            summary: "List the projects of the active organization",
            security: BEARER,
            parameters: [{ name: "limit", in: "query" }, { name: "x-organization-id", in: "header" }, { $ref: "#/components/parameters/OrganizationId" }],
            responses: { 200: { description: "ok", content: { "application/json": { schema: PROJECTS_SCHEMA } } } }
          },
          post: { responses: {} }
        },
        "/v1/gpu-models": { get: { description: "Get a list of gpu models per vendor. Based on the content from GitHub.", responses: {} } },
        "/v1/network-capacity": { get: { responses: {} } }
      });

      expect(publishedGetRoutesOf(document)).toEqual([
        {
          path: "/v1/projects",
          tag: "Projects",
          summary: "List the projects of the active organization",
          queryParameters: ["limit"],
          forSignedInUser: true,
          responseSchema: PROJECTS_SCHEMA
        },
        {
          path: "/v1/gpu-models",
          tag: "Other",
          summary: "Get a list of gpu models per vendor",
          queryParameters: [],
          forSignedInUser: false,
          responseSchema: undefined
        },
        { path: "/v1/network-capacity", tag: "Other", summary: "", queryParameters: [], forSignedInUser: false, responseSchema: undefined }
      ]);
    });

    it("leaves out routes with no GET", () => {
      const document = documentOf({ "/v1/assistant/conversations": { post: { responses: {} } }, "/v1/api-keys": { get: { responses: {} } } });

      expect(publishedGetRoutesOf(document).map(({ path }) => path)).toEqual(["/v1/api-keys"]);
    });

    it("lists nothing for a document without paths", () => {
      expect(publishedGetRoutesOf({ openapi: "3.0.0", info: { title: "Console API", version: "v1" } } as OpenAPIObject)).toEqual([]);
    });

    it("shortens a long summary to its first clause, or to whole words when the clause is long too", () => {
      const document = documentOf({
        "/v1/organizations": {
          get: {
            summary: "List the organizations the caller belongs to, marking the one this request ran in; an API key lists only one",
            responses: {}
          }
        },
        "/v1/trial-gpu-availability": {
          get: {
            summary: "Get the gpu models a free trial deployment may request and how many units of each are free right now",
            responses: {}
          }
        }
      });

      expect(publishedGetRoutesOf(document).map(({ summary }) => summary)).toEqual([
        "List the organizations the caller belongs to",
        "Get the gpu models a free trial deployment may request and"
      ]);
    });
  });

  describe(consoleApiRoutesOf.name, () => {
    it("keeps only the published GET routes on the list, leaving out any other GET route", () => {
      const document = documentOf({
        "/v1/api-keys": { get: { responses: JSON_OK } },
        "/v1/user/me": { get: { responses: JSON_OK } },
        "/v1/some-future-route": { get: { responses: JSON_OK } },
        "/v1/projects": { get: { responses: JSON_OK } },
        "/v1/providers/{address}": { get: { responses: JSON_OK } }
      });

      expect(consoleApiRoutesOf(document).map(({ path }) => path)).toEqual(["/v1/projects", "/v1/providers/{address}"]);
    });

    it("leaves out a listed route the document does not publish", () => {
      expect(consoleApiRoutesOf(documentOf({ "/v1/gpu": { get: { responses: JSON_OK } } })).map(({ path }) => path)).toEqual(["/v1/gpu"]);
    });

    it("leaves out a listed route without a JSON response schema, since nothing would keep its undocumented fields from the model", () => {
      const document = documentOf({ "/v1/gpu": { get: { responses: { 200: { description: "ok" } } } }, "/v1/projects": { get: { responses: JSON_OK } } });

      expect(consoleApiRoutesOf(document).map(({ path }) => path)).toEqual(["/v1/projects"]);
    });
  });

  describe(consoleApiCatalogOf.name, () => {
    it("writes one line per tag with each path, its query parameters and summary", () => {
      const catalog = consoleApiCatalogOf([
        route({ path: "/v1/projects", summary: "List the projects", queryParameters: ["limit", "skip"] }),
        route({ path: "/v1/organizations", tag: "Organizations", summary: "List the organizations" }),
        route({ path: "/v1/projects/{id}" })
      ]);

      expect(catalog).toBe("Projects: /v1/projects?limit,skip List the projects; /v1/projects/{id}\nOrganizations: /v1/organizations List the organizations");
    });
  });

  describe(matchesRouteTemplate.name, () => {
    it.each([
      ["/v1/projects/{id}", "/v1/projects/6f1c2a3e-9b8d-4c7e-a1f2-3b4c5d6e7f80", true],
      ["/v1/providers/{address}", "/v1/providers/akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh", true],
      ["/v1/market-data/{coin?}", "/v1/market-data", true],
      ["/v1/market-data/{coin?}", "/v1/market-data/akt", true],
      ["/v1/predicted-date-height/{timestamp}", "/v1/predicted-date-height/2026-11-06T00:00:00Z", true],
      ["/v1/projects/{id}", "/v1/projects", false],
      ["/v1/projects/{id}", "/v1/projects/1/members", false],
      ["/v1/projects/{id}", "/v1/projects/..", false],
      ["/v1/projects/{id}", "/v1/projects/.hidden", false],
      ["/v1/projects/{id}", "/v1/projects/%2e%2e", false],
      ["/v1/projects/{id}", "/v1/projects/1?limit=1", false],
      ["/v1/projects", "/v1/projectsX", false],
      ["/v1/projects", "/v1/projects/", false],
      ["/v1/user.me", "/v1/userXme", false]
    ])("matches %s against %s: %s", (template, path, matches) => {
      expect(matchesRouteTemplate(template, path)).toBe(matches);
    });
  });

  describe(isAssistantReadablePath.name, () => {
    it.each([
      ["/v1/deployments", true],
      ["/v1/deployments/42/info", true],
      ["/v1/providers/akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh", true],
      ["/v1/deployments/42", false],
      ["/v1/api-keys", false],
      ["/v1/user/me", false],
      ["/v1/projects/6f1c2a3e/members", false],
      ["/v1/organization-members", false],
      ["/v1/sdl-secrets-context", false]
    ])("reads %s: %s", (path, readable) => {
      expect(isAssistantReadablePath(path)).toBe(readable);
    });
  });

  describe(readableConsoleApiRouteOf.name, () => {
    it("matches a filled path of a listed route", () => {
      const routes = [route({ path: "/v1/projects/{id}" }), route({ path: "/v1/projects/{id}/members" })];

      expect(readableConsoleApiRouteOf(routes, "/v1/projects/p1")?.path).toBe("/v1/projects/{id}");
      expect(readableConsoleApiRouteOf(routes, "/v1/projects/p1/members")).toBeNull();
      expect(readableConsoleApiRouteOf(routes, "/v1/organizations")).toBeNull();
    });

    it("refuses a path a listed parameter would match when a static route that is not listed answers it", () => {
      const routes = [route({ path: "/v1/providers/{address}" }), route({ path: "/v1/providers/private-contacts" })];

      expect(readableConsoleApiRouteOf(routes, "/v1/providers/private-contacts")).toBeNull();
      expect(readableConsoleApiRouteOf(routes, "/v1/providers/akash1abc")?.path).toBe("/v1/providers/{address}");
    });

    it("refuses a listed route without a response schema", () => {
      expect(readableConsoleApiRouteOf([route({ path: "/v1/projects", responseSchema: undefined })], "/v1/projects")).toBeNull();
    });
  });

  describe(matchConsoleApiRoute.name, () => {
    it("prefers the route with the fewest parameters", () => {
      const routes = [route({ path: "/v1/stripe/payment-methods/{id}" }), route({ path: "/v1/stripe/payment-methods/default" })];

      expect(matchConsoleApiRoute(routes, "/v1/stripe/payment-methods/default")?.path).toBe("/v1/stripe/payment-methods/default");
      expect(matchConsoleApiRoute(routes, "/v1/stripe/payment-methods/pm_1")?.path).toBe("/v1/stripe/payment-methods/{id}");
      expect(matchConsoleApiRoute(routes, "/v1/stripe/charges")).toBeNull();
    });
  });
});
