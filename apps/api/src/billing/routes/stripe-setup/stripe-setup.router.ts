import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

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

const couponListRoute = createRoute({
  method: "get",
  path: "/v1/stripe-coupons",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            coupons: z.array(
              z.object({
                id: z.string(),
                percent_off: z.number().nullable().optional(),
                amount_off: z.number().nullable().optional(),
                valid: z.boolean(),
                name: z.string().optional(),
                description: z.string().optional()
              })
            )
          })
        }
      },
      description: "List of available coupons"
    }
  },
  tags: ["Stripe"]
});

const getCouponRoute = createRoute({
  method: "get",
  path: "/v1/stripe-coupons/{couponId}",
  summary: "Get a single coupon by ID",
  tags: ["Payment"],
  parameters: [
    {
      name: "couponId",
      in: "path",
      required: true,
      schema: {
        type: "string"
      }
    }
  ],
  responses: {
    200: {
      description: "Coupon retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            coupon: z.object({
              id: z.string(),
              percent_off: z.number().nullable().optional(),
              amount_off: z.number().nullable().optional(),
              valid: z.boolean(),
              name: z.string().optional(),
              description: z.string().optional()
            })
          })
        }
      }
    },
    404: {
      description: "Coupon not found"
    }
  }
});

const removePaymentMethodRoute = createRoute({
  method: "delete",
  path: "/v1/stripe-payment-methods/{paymentMethodId}",
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
    204: {
      description: "Payment method removed successfully"
    }
  }
});

export const stripeSetupRouter = new OpenApiHonoHandler();

stripeSetupRouter.openapi(setupIntentRoute, async function createSetupIntent(c) {
  const response = await container.resolve(StripeController).createSetupIntent();
  return c.json(response, 200);
});

stripeSetupRouter.openapi(paymentMethodsRoute, async function getPaymentMethods(c) {
  const response = await container.resolve(StripeController).getPaymentMethods();
  return c.json(response, 200);
});

stripeSetupRouter.openapi(confirmPaymentRoute, async function confirmPayment(c) {
  const body = await c.req.json();
  const response = await container.resolve(StripeController).confirmPayment(body);
  return c.json(response, 200);
});

stripeSetupRouter.openapi(applyCouponRoute, async function applyCoupon(c) {
  const body = await c.req.json();
  const response = await container.resolve(StripeController).applyCoupon(body.couponId);
  return c.json(response, 200);
});

stripeSetupRouter.openapi(couponListRoute, async function listCoupons(c) {
  const response = await container.resolve(StripeController).listCoupons();
  return c.json(response, 200);
});

stripeSetupRouter.openapi(getCouponRoute, async function getCoupon(c) {
  const couponId = c.req.param("couponId");
  const response = await container.resolve(StripeController).getCoupon(couponId);
  return c.json(response, 200);
});

stripeSetupRouter.openapi(removePaymentMethodRoute, async function removePaymentMethod(c) {
  const paymentMethodId = c.req.param("paymentMethodId");
  await container.resolve(StripeController).removePaymentMethod(paymentMethodId);
  return new Response(null, { status: 204 });
});
