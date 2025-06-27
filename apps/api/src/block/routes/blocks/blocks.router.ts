import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { BlockController } from "@src/block/controllers/block/block.controller";
import {
  GetBlockByHeightParamsSchema,
  GetBlockByHeightResponseSchema,
  ListBlocksQuerySchema,
  ListBlocksResponseSchema
} from "@src/block/http-schemas/block.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const listBlocksRoute = createRoute({
  method: "get",
  path: "/v1/blocks",
  summary: "Get a list of recent blocks.",
  tags: ["Blocks"],
  request: {
    query: ListBlocksQuerySchema
  },
  responses: {
    200: {
      description: "Returns block list",
      content: {
        "application/json": {
          schema: ListBlocksResponseSchema
        }
      }
    }
  }
});

const getBlockByHeightRoute = createRoute({
  method: "get",
  path: "/v1/blocks/{height}",
  summary: "Get a block by height.",
  tags: ["Blocks"],
  request: {
    params: GetBlockByHeightParamsSchema
  },
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: GetBlockByHeightResponseSchema
        }
      }
    },
    404: {
      description: "Block not found"
    },
    400: {
      description: "Invalid height"
    }
  }
});

export const blocksRouter = new OpenApiHonoHandler();

blocksRouter.openapi(listBlocksRoute, async function routeListBlocks(c) {
  const { limit } = c.req.valid("query");
  const blocks = await container.resolve(BlockController).getBlocks(limit);

  return c.json(blocks);
});

blocksRouter.openapi(getBlockByHeightRoute, async function routeGetBlockByHeight(c) {
  const { height } = c.req.valid("param");

  const block = await container.resolve(BlockController).getBlockWithTransactionsByHeight(height);
  if (block) {
    return c.json(block);
  } else {
    return c.text("Block not found", 404);
  }
});
