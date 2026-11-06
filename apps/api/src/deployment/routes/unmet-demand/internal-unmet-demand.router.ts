import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { UnmetDemandQuerySchema, UnmetDemandResponseSchema } from "@src/deployment/http-schemas/unmet-demand.schema";
import { UnmetDemandReportService } from "@src/deployment/services/unmet-demand-report/unmet-demand-report.service";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalUnmetDemandRouter = new OpenApiHonoHandler();

const listUnmetDemandRoute = createRoute({
  method: "get",
  path: "/unmet-demand",
  operationId: "listUnmetDemand",
  summary: "Anonymous gpu demand Console saw and could not serve, per model and region area, with the requests, supply and prices around it",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { query: UnmetDemandQuerySchema },
  responses: {
    200: { description: "One row per model and region area, most unmet first", content: { "application/json": { schema: UnmetDemandResponseSchema } } },
    400: { description: "Invalid window" },
    401: { description: "Missing or wrong internal token" }
  }
});

internalUnmetDemandRouter.openapi(listUnmetDemandRoute, async function routeListUnmetDemand(c) {
  return c.json(await container.resolve(UnmetDemandReportService).report(c.req.valid("query")), 200);
});
