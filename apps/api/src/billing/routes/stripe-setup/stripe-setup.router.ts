import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { AuthService } from "@src/auth/services/auth.service";
import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const setupIntentRoute = createRoute({
  method: "post",
  path: "/v1/stripe-setup",
  summary: "Create a Stripe SetupIntent for adding a payment method",
  tags: ["Payment"],
  request: {},
  responses: {
    200: {
      description: "SetupIntent created successfully",
      content: {
        "application/json": {
          schema: z.object({
            clientSecret: z.string()
          })
        }
      }
    }
  }
});

const paymentMethodsRoute = createRoute({
  method: "get",
  path: "/v1/stripe-payment-methods",
  summary: "Get all payment methods for the current user",
  tags: ["Payment"],
  request: {},
  responses: {
    200: {
      description: "Payment methods retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                card: z.object({
                  brand: z.string(),
                  last4: z.string(),
                  exp_month: z.number(),
                  exp_year: z.number()
                }),
                created: z.number()
              })
            )
          })
        }
      }
    }
  }
});

export const stripeSetupRouter = new OpenApiHonoHandler();

stripeSetupRouter.openapi(setupIntentRoute, async function createSetupIntent(c) {
  const authService = container.resolve(AuthService);
  const response = await container.resolve(StripeController).createSetupIntent(authService.currentUser.userId);
  return c.json(response, 200);
});

stripeSetupRouter.openapi(paymentMethodsRoute, async function getPaymentMethods(c) {
  const authService = container.resolve(AuthService);
  const response = await container.resolve(StripeController).getPaymentMethods(authService.currentUser.userId);
  return c.json(response, 200);
});
