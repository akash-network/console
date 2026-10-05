import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProductUpdateUnsubscriptionController } from "@src/user/controllers/product-update-unsubscription/product-update-unsubscription.controller";
import { CreateProductUpdateUnsubscriptionQuerySchema } from "@src/user/schemas/product-update-unsubscription.schema";

export const productUpdateUnsubscriptionsRouter = new OpenApiHonoHandler();

const createProductUpdateUnsubscriptionRoute = createRoute({
  method: "post",
  operationId: "createProductUpdateUnsubscription",
  path: "/v1/product-update-unsubscriptions",
  summary: "Stop product update emails for the user an unsubscribe link was sent to, without signing in (RFC 8058 one-click)",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    query: CreateProductUpdateUnsubscriptionQuerySchema
  },
  responses: {
    204: { description: "The user no longer receives product update emails" },
    400: { description: "The unsubscribe link is invalid" },
    503: { description: "Unsubscribe links are not configured" }
  }
});

productUpdateUnsubscriptionsRouter.openapi(createProductUpdateUnsubscriptionRoute, async function routeCreateProductUpdateUnsubscription(c) {
  await container.resolve(ProductUpdateUnsubscriptionController).create(c.req.valid("query").token);
  return c.body(null, 204);
});
