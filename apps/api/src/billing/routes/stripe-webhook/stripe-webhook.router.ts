import { container } from "tsyringe";
import { z } from "zod";

import { CheckoutController } from "@src/billing/controllers/checkout/checkout.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const stripeWebhook = new OpenApiHonoHandler();

const route = createRoute({
  method: "post",
  path: "/v1/stripe-webhook",
  summary: "Stripe Webhook Handler",
  tags: ["Payment"],
  security: SECURITY_NONE,
  request: {
    body: {
      content: {
        "text/plain": {
          schema: z.string()
        }
      }
    }
  },
  responses: {
    200: {
      description: "Webhook processed successfully",
      content: {}
    },
    400: {
      description: "Stripe signature is required",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string()
          })
        }
      }
    }
  }
});
stripeWebhook.openapi(route, async function routeStripeWebhook(c) {
  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "Stripe signature is required" }, 400);
  }

  await container.resolve(CheckoutController).webhook(sig, await c.req.text());
  return c.text("", 200) as never;
});
