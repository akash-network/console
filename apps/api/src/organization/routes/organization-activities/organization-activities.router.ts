import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { OrganizationActivityController } from "@src/organization/controllers/organization-activity/organization-activity.controller";
import { ListOrganizationActivitiesQuerySchema, ListOrganizationActivitiesResponseSchema } from "@src/organization/http-schemas/organization-activity.schema";

export const organizationActivitiesRouter = new OpenApiHonoHandler();

const listOrganizationActivitiesRoute = createRoute({
  method: "get",
  path: "/v1/organization-activities",
  operationId: "listOrganizationActivities",
  summary: "List what happened in the active organization, newest first, within the caller's projects",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { query: ListOrganizationActivitiesQuerySchema },
  responses: {
    200: { description: "A page of activities", content: { "application/json": { schema: ListOrganizationActivitiesResponseSchema } } },
    400: { description: "The query or cursor is not valid" },
    401: { description: "Unauthorized" }
  }
});

organizationActivitiesRouter.openapi(listOrganizationActivitiesRoute, async function routeListOrganizationActivities(c) {
  return c.json(await container.resolve(OrganizationActivityController).list(c.req.valid("query")), 200);
});
