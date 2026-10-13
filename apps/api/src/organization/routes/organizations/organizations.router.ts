import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { OrganizationController } from "@src/organization/controllers/organization/organization.controller";
import { ListOrganizationsResponseSchema } from "@src/organization/http-schemas/organization.schema";

export const organizationsRouter = new OpenApiHonoHandler();

const listOrganizationsRoute = createRoute({
  method: "get",
  path: "/v1/organizations",
  operationId: "listOrganizations",
  summary: "List the organizations the caller belongs to, marking the one this request ran in",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  responses: {
    200: { description: "The caller's organizations", content: { "application/json": { schema: ListOrganizationsResponseSchema } } },
    400: { description: "The organization header names another organization than the API key's" },
    401: { description: "Unauthorized" },
    403: { description: "The organization or project header names one the caller cannot reach" }
  }
});

organizationsRouter.openapi(listOrganizationsRoute, async function routeListOrganizations(c) {
  return c.json(await container.resolve(OrganizationController).list(), 200);
});
