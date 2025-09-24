import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { BidController } from "@src/bid/controllers/bid/bid.controller";
import { ListBidsQuerySchema, ListBidsResponseSchema } from "@src/bid/http-schemas/bid.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

export const bidsRouter = new OpenApiHonoHandler();

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

bidsRouter.openapi(listRoute, async function routeListBids(c) {
  const { dseq } = c.req.valid("query");
  const result = await container.resolve(BidController).list(dseq);
  return c.json(result, 200);
});

const listByDseqRoute = createRoute({
  method: "get",
  path: "/v1/bids/{dseq}",
  summary: "List bids by dseq",
  tags: ["Bids"],
  request: {
    params: ListBidsQuerySchema
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

bidsRouter.openapi(listByDseqRoute, async function routeListBids(c) {
  const { dseq } = c.req.valid("param");
  const result = await container.resolve(BidController).list(dseq);
  return c.json(result, 200);
});
