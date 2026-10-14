import { container } from "tsyringe";

import { FirstPurchaseBonusController } from "@src/billing/controllers/first-purchase-bonus/first-purchase-bonus.controller";
import { FirstPurchaseBonusResponseSchema } from "@src/billing/http-schemas/stripe.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const firstPurchaseBonusRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getFirstPurchaseBonus",
  path: "/v1/stripe/first-purchase-bonus",
  summary: "Whether the caller's next qualifying purchase for the active organization earns the first-purchase bonus",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  hiddenInOpenApiDocs: true,
  responses: {
    200: {
      description: "First-purchase bonus eligibility",
      content: {
        "application/json": {
          schema: FirstPurchaseBonusResponseSchema
        }
      }
    }
  }
});

firstPurchaseBonusRouter.openapi(route, async function routeGetFirstPurchaseBonus(c) {
  return c.json(await container.resolve(FirstPurchaseBonusController).getFirstPurchaseBonus(), 200);
});
