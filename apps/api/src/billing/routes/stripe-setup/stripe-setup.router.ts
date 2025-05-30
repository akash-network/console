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

const confirmPaymentRoute = createRoute({
  method: "post",
  path: "/v1/stripe-payment",
  summary: "Confirm a payment using a saved payment method",
  tags: ["Payment"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            paymentMethodId: z.string(),
            amount: z.number(),
            currency: z.string(),
            coupon: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Payment processed",
      content: {
        "application/json": {
          schema: z.object({
            error: z
              .object({
                message: z.string()
              })
              .optional()
          })
        }
      }
    }
  }
});

const applyCouponRoute = createRoute({
  method: "post",
  path: "/v1/stripe-coupon",
  summary: "Apply a coupon to the current user",
  tags: ["Payment"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            couponId: z.string()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Coupon applied successfully",
      content: {
        "application/json": {
          schema: z.object({
            coupon: z.any()
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

stripeSetupRouter.openapi(confirmPaymentRoute, async function confirmPayment(c) {
  const authService = container.resolve(AuthService);
  const body = await c.req.json();
  const response = await container.resolve(StripeController).confirmPayment(authService.currentUser.userId, body);
  return c.json(response, 200);
});

stripeSetupRouter.openapi(applyCouponRoute, async function applyCoupon(c) {
  const authService = container.resolve(AuthService);
  const body = await c.req.json();
  const response = await container.resolve(StripeController).applyCoupon(authService.currentUser.userId, body.couponId);
  return c.json(response, 200);
});
