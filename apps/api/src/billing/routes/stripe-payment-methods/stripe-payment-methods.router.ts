import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import {
  PaymentMethodsResponseSchema,
  SetupIntentResponseSchema,
  ValidatePaymentMethodRequestSchema,
  ValidatePaymentMethodResponseSchema
} from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

const setupIntentRoute = createRoute({
  method: "post",
  path: "/v1/stripe/payment-methods/setup",
  summary: "Create a Stripe SetupIntent for adding a payment method",
  description:
    "Creates a Stripe SetupIntent that allows users to securely add payment methods to their account. The SetupIntent provides a client secret that can be used with Stripe's frontend SDKs to collect payment method details.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "SetupIntent created successfully with client secret",
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
  path: "/v1/stripe/payment-methods",
  summary: "Get all payment methods for the current user",
  description:
    "Retrieves all saved payment methods associated with the current user's account, including card details, validation status, and billing information.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
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
  path: "/v1/stripe/payment-methods/:paymentMethodId",
  summary: "Remove a payment method",
  description: "Permanently removes a saved payment method from the user's account. This action cannot be undone.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  parameters: [
    {
      name: "paymentMethodId",
      in: "path",
      required: true,
      schema: {
        type: "string"
      },
      description: "The unique identifier of the payment method to remove"
    }
  ],
  responses: {
    204: {
      description: "Payment method removed successfully"
    }
  }
});

const validatePaymentMethodRoute = createRoute({
  method: "post",
  path: "/v1/stripe/payment-methods/validate",
  summary: "Validates a payment method after 3D Secure authentication",
  description:
    "Completes the validation process for a payment method that required 3D Secure authentication. This endpoint should be called after the user completes the 3D Secure challenge.",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: ValidatePaymentMethodRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Payment method validated successfully",
      content: {
        "application/json": {
          schema: ValidatePaymentMethodResponseSchema
        }
      }
    }
  }
});

export const stripePaymentMethodsRouter = new OpenApiHonoHandler();

stripePaymentMethodsRouter.openapi(setupIntentRoute, async function createSetupIntent(c) {
  const response = await container.resolve(StripeController).createSetupIntent();
  return c.json(response, 200);
});

stripePaymentMethodsRouter.openapi(paymentMethodsRoute, async function getPaymentMethods(c) {
  const response = await container.resolve(StripeController).getPaymentMethods();
  return c.json(response, 200);
});

stripePaymentMethodsRouter.openapi(removePaymentMethodRoute, async function removePaymentMethod(c) {
  const { paymentMethodId } = c.req.param();
  await container.resolve(StripeController).removePaymentMethod(paymentMethodId);
  return c.body(null, 204);
});

stripePaymentMethodsRouter.openapi(validatePaymentMethodRoute, async function validatePaymentMethod(c) {
  return c.json(await container.resolve(StripeController).validatePaymentMethodAfter3DS(c.req.valid("json")), 200);
});
