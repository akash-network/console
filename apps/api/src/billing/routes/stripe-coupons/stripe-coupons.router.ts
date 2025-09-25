import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { ApplyCouponRequestSchema, ApplyCouponResponseSchema } from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const applyCouponRoute = createRoute({
  method: "post",
  path: "/v1/stripe/coupons/apply",
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

export const stripeCouponsRouter = new OpenApiHonoHandler();

stripeCouponsRouter.openapi(applyCouponRoute, async function applyCoupon(c) {
  const { data } = c.req.valid("json");
  const response = await container.resolve(StripeController).applyCoupon(data);
  return c.json(response, 200);
});
