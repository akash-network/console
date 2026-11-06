import type { OpenAPIObject } from "openapi3-ts/oas30";
import { describe, expect, it } from "vitest";

import {
  consoleApiCatalogOf,
  type ConsoleApiRoute,
  consoleApiRoutesOf,
  DENIED_CONSOLE_API_ROUTES,
  isDeniedConsoleApiPath,
  matchConsoleApiRoute,
  matchesRouteTemplate
} from "./console-api-catalog";

const BEARER = [{ BearerAuth: [] }];
const PROJECTS_SCHEMA = { type: "object", properties: { data: { type: "array" } } } as const;

function documentOf(paths: OpenAPIObject["paths"]): OpenAPIObject {
  return { openapi: "3.0.0", info: { title: "Console API", version: "v1" }, paths };
}

function route(overrides: Partial<ConsoleApiRoute> & { path: string }): ConsoleApiRoute {
  return { tag: "Projects", summary: "", queryParameters: [], forSignedInUser: true, ...overrides };
}

describe("console-api-catalog", () => {
  describe(consoleApiRoutesOf.name, () => {
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

      expect(consoleApiRoutesOf(document)).toEqual([
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

    it("leaves out every denied route and routes with no GET", () => {
      const document = documentOf({
        "/v1/sdl-secrets-context": { get: { responses: {} } },
        "/v1/deployments/{dseq}": { get: { responses: {} } },
        "/v1/assistant/conversations": { post: { responses: {} } },
        "/v1/projects": { get: { responses: {} } }
      });

      expect(consoleApiRoutesOf(document).map(({ path }) => path)).toEqual(["/v1/projects"]);
    });

    it("lists nothing for a document without paths", () => {
      expect(consoleApiRoutesOf({ openapi: "3.0.0", info: { title: "Console API", version: "v1" } } as OpenAPIObject)).toEqual([]);
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

      expect(consoleApiRoutesOf(document).map(({ summary }) => summary)).toEqual([
        "List the organizations the caller belongs to",
        "Get the gpu models a free trial deployment may request and"
      ]);
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

  describe(isDeniedConsoleApiPath.name, () => {
    it("denies a filled path of any denied route", () => {
      expect(isDeniedConsoleApiPath("/v1/sdl-secrets-context")).toBe(true);
      expect(isDeniedConsoleApiPath("/v1/deployments/42")).toBe(true);
      expect(isDeniedConsoleApiPath("/akash/deployment/v1beta4/deployments/list")).toBe(true);
      expect(isDeniedConsoleApiPath("/v1/deployments")).toBe(false);
      expect(isDeniedConsoleApiPath("/v1/deployments/42/info")).toBe(false);
    });

    it("gives a reason for every denied route", () => {
      expect(Object.values(DENIED_CONSOLE_API_ROUTES).every(reason => reason.length > 0)).toBe(true);
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
