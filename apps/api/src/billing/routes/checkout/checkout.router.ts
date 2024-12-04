import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { CheckoutController } from "@src/billing/controllers/checkout/checkout.controller";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const route = createRoute({
  method: "get",
  path: "/v1/checkout",
  summary: "Creates a stripe checkout session and redirects to checkout",
  tags: ["Wallet"],
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

export const checkoutRouter = new OpenApiHonoHandler();

checkoutRouter.openapi(route, async function routeCheckout(c) {
  return await container.resolve(CheckoutController).checkout(c);
});
