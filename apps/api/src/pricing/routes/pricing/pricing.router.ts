import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { PricingController } from "@src/pricing/controllers/pricing/pricing.controller";
import { PricingBodySchema, PricingResponseSchema } from "@src/pricing/http-schemas/pricing.schema";

const postPricingRoute = createRoute({
  method: "post",
  path: "/v1/pricing",
  tags: ["Other"],
  summary: "Estimate the price of a deployment on akash and other cloud providers.",
  request: {
    body: {
      description:
        "Deployment specs to use for the price estimation. **An array of specs can also be sent, in that case an array of estimations will be returned in the same order.**",
      content: {
        "application/json": {
          schema: PricingBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by cateogories",
      content: {
        "application/json": {
          schema: PricingResponseSchema
        }
      }
    },
    400: {
      description: "Invalid parameters"
    }
  }
});
export const pricingRouter = new OpenApiHonoHandler();

pricingRouter.openapi(postPricingRoute, async function routePostPricing(c) {
  const body = PricingBodySchema.parse(await c.req.json());
  const pricing = container.resolve(PricingController).getPricing(body);

  return c.json(pricing);
});
