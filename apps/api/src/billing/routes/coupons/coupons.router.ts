import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { ApplyCouponRequestSchema, ApplyCouponResponseSchema, CustomerDiscountsResponseSchema } from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const applyCouponRoute = createRoute({
  method: "post",
  path: "/v1/coupons/apply",
  summary: "Apply a coupon to the current user",
  tags: ["Payment"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: ApplyCouponRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Coupon applied successfully",
      content: {
        "application/json": {
          schema: ApplyCouponResponseSchema
        }
      }
    }
  }
});

const getCustomerDiscountsRoute = createRoute({
  method: "get",
  path: "/v1/coupons/customer-discounts",
  summary: "Get current discounts applied to the customer",
  tags: ["Payment"],
  responses: {
    200: {
      description: "Customer discounts retrieved successfully",
      content: {
        "application/json": {
          schema: CustomerDiscountsResponseSchema
        }
      }
    }
  }
});

export const couponsRouter = new OpenApiHonoHandler();

couponsRouter.openapi(applyCouponRoute, async function applyCoupon(c) {
  const body = await c.req.json();
  const response = await container.resolve(StripeController).applyCoupon(body.couponId);
  return c.json(response, 200);
});

couponsRouter.openapi(getCustomerDiscountsRoute, async function getCustomerDiscounts(c) {
  const response = await container.resolve(StripeController).getCustomerDiscounts();
  return c.json(response, 200);
});
