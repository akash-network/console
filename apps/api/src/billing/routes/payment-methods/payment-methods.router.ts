import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { PaymentMethodsResponseSchema, SetupIntentResponseSchema } from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const setupIntentRoute = createRoute({
  method: "post",
  path: "/v1/payment-methods/setup",
  summary: "Create a Stripe SetupIntent for adding a payment method",
  tags: ["Payment"],
  request: {},
  responses: {
    200: {
      description: "SetupIntent created successfully",
      content: {
        "application/json": {
          schema: SetupIntentResponseSchema
        }
      }
    }
  }
});

const paymentMethodsRoute = createRoute({
  method: "get",
  path: "/v1/payment-methods",
  summary: "Get all payment methods for the current user",
  tags: ["Payment"],
  request: {},
  responses: {
    200: {
      description: "Payment methods retrieved successfully",
      content: {
        "application/json": {
          schema: PaymentMethodsResponseSchema
        }
      }
    }
  }
});

const removePaymentMethodRoute = createRoute({
  method: "delete",
  path: "/v1/payment-methods/:paymentMethodId",
  summary: "Remove a payment method",
  tags: ["Payment"],
  parameters: [
    {
      name: "paymentMethodId",
      in: "path",
      required: true,
      schema: {
        type: "string"
      }
    }
  ],
  responses: {
    200: {
      description: "Payment method removed successfully"
    }
  }
});

export const paymentMethodsRouter = new OpenApiHonoHandler();

paymentMethodsRouter.openapi(setupIntentRoute, async function createSetupIntent(c) {
  const response = await container.resolve(StripeController).createSetupIntent();
  return c.json(response, 200);
});

paymentMethodsRouter.openapi(paymentMethodsRoute, async function getPaymentMethods(c) {
  const response = await container.resolve(StripeController).getPaymentMethods();
  return c.json(response, 200);
});

paymentMethodsRouter.openapi(removePaymentMethodRoute, async function removePaymentMethod(c) {
  const { paymentMethodId } = c.req.param();
  await container.resolve(StripeController).removePaymentMethod(paymentMethodId);
  return c.json({}, 200);
});
