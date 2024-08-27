import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { CheckoutController } from "@src/billing/controllers/checkout/checkout.controller";
import { OpenApiHonoHandled } from "@src/core/services/open-api-hono-handled/open-api-hono-handled";

const route = createRoute({
  method: "post",
  path: "/v1/stripe-webhook",
  summary: "",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.any()
        }
      }
    }
  },
  responses: {
    200: {
      description: "",
      content: {
        "application/json": {
          schema: z.void()
        }
      }
    }
  }
});

export const stripeWebhook = new OpenApiHonoHandled();

stripeWebhook.openapi(route, async function routeStripeWebhook(c) {
  const sig = c.req.header("stripe-signature");
  await container.resolve(CheckoutController).webhook(sig, await c.req.text());
  return c.json({}, 200);
});
