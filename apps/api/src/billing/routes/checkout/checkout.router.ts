import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { CheckoutController } from "@src/billing/controllers/checkout/checkout.controller";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

const route = createRoute({
  method: "get",
  path: "/v1/checkout",
  summary: "Creates a stripe checkout session and redirects to checkout",
  tags: ["Wallets"],
  request: {},
  responses: {
    301: {
      description: "Redirects to the checkout page"
    }
  }
});

export const checkoutRouter = new OpenApiHonoHandled();

checkoutRouter.openapi(route, async function routeCheckout(c) {
  return await container.resolve(CheckoutController).checkout(c);
});
