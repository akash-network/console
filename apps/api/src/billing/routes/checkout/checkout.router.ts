import { container } from "tsyringe";
import { z } from "zod";

import { CheckoutController } from "@src/billing/controllers/checkout/checkout.controller";
import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const checkoutRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/checkout",
  summary: "Creates a stripe checkout session and redirects to checkout",
  tags: ["Wallet"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    query: z.object({
      amount: z.string().optional()
    })
  },
  responses: {
    301: {
      description: "Redirects to the checkout page"
    }
  }
});
checkoutRouter.openapi(route, async function routeCheckout(c) {
  return await container.resolve(CheckoutController).checkout(c);
});
