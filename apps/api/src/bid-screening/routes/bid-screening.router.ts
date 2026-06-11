import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { BidScreeningController } from "../controllers/bid-screening/bid-screening.controller";
import { BidScreeningRequestSchema, BidScreeningResponseSchema } from "../http-schemas/bid-screening.schema";

export const bidScreeningRouter = new OpenApiHonoHandler();

const postBidScreeningRoute = createRoute({
  method: "post",
  path: "/v1/bid-screening",
  summary: "Screen providers by deployment resource requirements",
  tags: ["Bid Screening"],
  security: SECURITY_NONE,
  bodyLimit: { maxSize: 64 * 1024 },
  request: {
    body: {
      content: {
        "application/json": {
          schema: BidScreeningRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns matching providers",
      content: {
        "application/json": {
          schema: BidScreeningResponseSchema
        }
      }
    },
    400: {
      description: "Invalid request body"
    }
  }
});

bidScreeningRouter.openapi(postBidScreeningRoute, async function routePostBidScreening(c) {
  const request = c.req.valid("json");
  const response = await container.resolve(BidScreeningController).screenProviders(request, { signal: c.req.raw.signal });
  return c.json(response, 200);
});
