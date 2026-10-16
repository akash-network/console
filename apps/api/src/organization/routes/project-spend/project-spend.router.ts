import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ProjectSpendController } from "@src/organization/controllers/project-spend/project-spend.controller";
import { ListDeploymentSpendQuerySchema, ListDeploymentSpendResponseSchema } from "@src/organization/http-schemas/deployment-spend.schema";
import { ListProjectSpendQuerySchema, ListProjectSpendResponseSchema } from "@src/organization/http-schemas/project-spend.schema";

export const projectSpendRouter = new OpenApiHonoHandler();

const listProjectSpendRoute = createRoute({
  method: "get",
  path: "/v1/project-spend",
  operationId: "listProjectSpend",
  summary: "Report the active organization's spend per project over a date range",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { query: ListProjectSpendQuerySchema },
  responses: {
    200: {
      description:
        "Spend of the projects the caller can see, with the organization's total and unassigned remainder when the caller can see the whole organization",
      content: { "application/json": { schema: ListProjectSpendResponseSchema } }
    },
    400: { description: "Dates must be YYYY-MM-DD, startDate must not be after endDate and the range cannot exceed 366 days" },
    401: { description: "Unauthorized" }
  }
});

projectSpendRouter.openapi(listProjectSpendRoute, async function routeListProjectSpend(c) {
  return c.json(await container.resolve(ProjectSpendController).list(c.req.valid("query")), 200);
});

const listDeploymentSpendRoute = createRoute({
  method: "get",
  path: "/v1/deployment-spend",
  operationId: "listDeploymentSpend",
  summary: "Report what the active organization's deployments consumed over a date range, per deployment and per project and day",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { query: ListDeploymentSpendQuerySchema },
  responses: {
    200: {
      description:
        "Spend of the deployments in the projects the caller can see, with the deployments filed in no project when the caller can see the whole organization",
      content: { "application/json": { schema: ListDeploymentSpendResponseSchema } }
    },
    400: { description: "Dates must be YYYY-MM-DD, startDate must not be after endDate and the range cannot exceed 366 days" },
    401: { description: "Unauthorized" }
  }
});

projectSpendRouter.openapi(listDeploymentSpendRoute, async function routeListDeploymentSpend(c) {
  return c.json(await container.resolve(ProjectSpendController).listDeployments(c.req.valid("query")), 200);
});
