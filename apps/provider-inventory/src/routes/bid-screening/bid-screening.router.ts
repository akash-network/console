import { container } from "tsyringe";

import { BidScreeningController } from "@src/controllers/bid-screening/bid-screening.controller";
import { BidScreeningRequestSchema, BidScreeningResponseSchema } from "@src/http-schemas/bid-screening.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const bidScreeningRouter = new OpenApiHonoHandler();

const postBidScreeningRoute = createRoute({
  method: "post",
  path: "/v1/bid-screening",
  summary: "Screen providers by deployment resource requirements",
  tags: ["Bid Screening"],
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
  const response = await container.resolve(BidScreeningController).screenProviders(request);
  return c.json(response, 200);
});
