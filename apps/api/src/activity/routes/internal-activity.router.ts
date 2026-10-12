import { container } from "tsyringe";

import { ActivityController } from "@src/activity/controllers/activity/activity.controller";
import { CreateAlertActivityRequestSchema } from "@src/activity/http-schemas/activity.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalActivityRouter = new OpenApiHonoHandler();

const createAlertActivityRoute = createRoute({
  method: "post",
  path: "/activities",
  operationId: "createAlertActivity",
  summary: "Add a fired alert to a user's activity feed, once per dedupe key",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    body: { required: true, content: { "application/json": { schema: CreateAlertActivityRequestSchema } } }
  },
  responses: {
    204: { description: "The alert is in the user's feed, or an entry holding its dedupe key already was" },
    400: { description: "Invalid request body" },
    401: { description: "Missing or wrong internal token" },
    404: { description: "No user has this id" }
  }
});

internalActivityRouter.openapi(createAlertActivityRoute, async function routeCreateAlertActivity(c) {
  await container.resolve(ActivityController).createAlert(c.req.valid("json"));
  return c.body(null, 204);
});
