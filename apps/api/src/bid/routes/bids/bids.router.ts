import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { BidController } from "@src/bid/controllers/bid/bid.controller";
import { ListBidsQuerySchema, ListBidsResponseSchema } from "@src/bid/http-schemas/bid.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const listRoute = createRoute({
  method: "get",
  path: "/v1/bids",
  summary: "List bids",
  tags: ["Bids"],
  request: {
    query: ListBidsQuerySchema
  },
  responses: {
    200: {
      description: "List of bids",
      content: {
        "application/json": {
          schema: ListBidsResponseSchema
        }
      }
    }
  }
});

export const bidsRouter = new OpenApiHonoHandler();

bidsRouter.openapi(listRoute, async function routeListBids(c) {
  const { dseq, userId } = c.req.valid("query");
  const result = await container.resolve(BidController).list(dseq, userId);
  return c.json(result, 200);
});
