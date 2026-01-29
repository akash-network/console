import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { PricingController } from "@src/pricing/controllers/pricing/pricing.controller";
import { PricingBodySchema, PricingResponseSchema } from "@src/pricing/http-schemas/pricing.schema";

export const pricingRouter = new OpenApiHonoHandler();

const postPricingRoute = createRoute({
  method: "post",
  path: "/v1/pricing",
  tags: ["Other"],
  security: SECURITY_NONE,
  summary: "Estimate the price of a deployment on akash and other cloud providers.",
  bodyLimit: {
    maxSize: 512 // 512 bytes
  },
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
pricingRouter.openapi(postPricingRoute, async function routePostPricing(c) {
  const body = PricingBodySchema.parse(await c.req.json());
  const pricing = container.resolve(PricingController).getPricing(body);

  return c.json(pricing);
});
