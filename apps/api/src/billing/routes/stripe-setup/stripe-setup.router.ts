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
  path: "/v1/stripe-payment-methods/:paymentMethodId",
  summary: "Remove a payment method",
  tags: ["Payment"],
  request: {
    params: z.object({
      paymentMethodId: z.string()
    })
  },
  responses: {
    200: {
      description: "Payment method removed successfully"
    }
  }
});

const getCustomerDiscountsRoute = createRoute({
  method: "get",
  path: "/v1/stripe-customer-discounts",
  summary: "Get current discounts applied to the customer",
  tags: ["Payment"],
  responses: {
    200: {
      description: "Customer discounts retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            discounts: z.array(
              z.object({
                type: z.enum(["coupon", "promotion_code"]),
                id: z.string(),
                name: z.string().optional(),
                code: z.string().optional(),
                percent_off: z.number().optional(),
                amount_off: z.number().optional(),
                currency: z.string().optional(),
                valid: z.boolean()
              })
            )
          })
        }
      }
    }
  }
});

const getCustomerTransactionsRoute = createRoute({
  method: "get",
  path: "/v1/stripe-transactions",
  summary: "Get transaction history for the current customer",
  tags: ["Payment"],
  request: {
    query: z.object({
      limit: z.string().optional().openapi({
        type: "number",
        minimum: 1,
        maximum: 100,
        description: "Number of transactions to return",
        example: "100",
        default: "100"
      }),
      startingAfter: z.string().optional().openapi({
        description: "ID of the last transaction from the previous page",
        example: "ch_1234567890"
      })
    })
  },
  responses: {
    200: {
      description: "Customer transactions retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            transactions: z.array(
              z.object({
                id: z.string(),
                amount: z.number(),
                currency: z.string(),
                status: z.string(),
                created: z.number(),
                paymentMethod: z.any(),
                receiptUrl: z.string().optional(),
                description: z.string().optional(),
                metadata: z.record(z.string()).optional()
              })
            ),
            hasMore: z.boolean(),
            nextPage: z.string().optional()
          })
        }
      }
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

stripeSetupRouter.openapi(getCouponRoute, async function getCoupon(c) {
  const couponId = c.req.param("couponId");
  const response = await container.resolve(StripeController).getCoupon(couponId);
  return c.json(response, 200);
});

stripeSetupRouter.openapi(removePaymentMethodRoute, async function removePaymentMethod(c) {
  const { paymentMethodId } = c.req.param();
  await container.resolve(StripeController).removePaymentMethod(paymentMethodId);
  return c.json({}, 200);
});

stripeSetupRouter.openapi(getCustomerDiscountsRoute, async function getCustomerDiscounts(c) {
  const response = await container.resolve(StripeController).getCustomerDiscounts();
  return c.json(response, 200);
});

stripeSetupRouter.openapi(getCustomerTransactionsRoute, async function getCustomerTransactions(c) {
  const { limit, startingAfter } = c.req.valid("query");
  const response = await container.resolve(StripeController).getCustomerTransactions({
    limit: limit ? parseInt(limit) : undefined,
    startingAfter
  });
  return c.json(response, 200);
});
