import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { HardwareRequestBrokerController } from "@src/hardware-request/controllers/hardware-request-broker/hardware-request-broker.controller";
import { HardwareRequestQueueQuerySchema, HardwareRequestQueueResponseSchema } from "@src/hardware-request/http-schemas/hardware-request-broker.schema";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalHardwareRequestRouter = new OpenApiHonoHandler();

const listQueueRoute = createRoute({
  method: "get",
  path: "/hardware-requests",
  operationId: "listHardwareRequestQueue",
  summary: "The team's queue of GPU requests across every organization",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { query: HardwareRequestQueueQuerySchema },
  responses: {
    200: { description: "The requests matching the filters", content: { "application/json": { schema: HardwareRequestQueueResponseSchema } } },
    400: { description: "Invalid filters" },
    401: { description: "Missing or wrong internal token" }
  }
});

internalHardwareRequestRouter.openapi(listQueueRoute, async function routeListHardwareRequestQueue(c) {
  return c.json(await container.resolve(HardwareRequestBrokerController).listQueue(c.req.valid("query")), 200);
});
