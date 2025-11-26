import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { AuditorController } from "@src/provider/controllers/auditor/auditor.controller";
import { AuditorListResponseSchema } from "@src/provider/http-schemas/auditor.schema";

const auditorListRoute = createRoute({
  method: "get",
  path: "/v1/auditors",
  tags: ["Providers"],
  security: SECURITY_NONE,
  summary: "Get a list of auditors.",
  responses: {
    200: {
      description: "List of auditors",
      content: {
        "application/json": {
          schema: AuditorListResponseSchema
        }
      }
    }
  }
});
export const auditorsRouter = new OpenApiHonoHandler();

auditorsRouter.openapi(auditorListRoute, async function routeListAuditors(c) {
  const auditors = await container.resolve(AuditorController).getAuditors();
  return c.json(auditors);
});
