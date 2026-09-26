import createError from "http-errors";
import { container } from "tsyringe";

import { GetBlockParamsSchema, GetBlockResponseSchema, ListBlocksQuerySchema, ListBlocksResponseSchema } from "@src/http-schemas/blocks.schema";
import { createRoute } from "@src/lib/create-route/create-route";
import { BlockQueryService } from "@src/services/block-query/block-query.service";
import { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export const blocksRouter = new OpenApiHonoHandler();

const listBlocksRoute = createRoute({
  method: "get",
  path: "/v1/blocks",
  operationId: "listBlocks",
  summary: "List the most recent blocks",
  tags: ["Blocks"],
  request: {
    query: ListBlocksQuerySchema
  },
  responses: {
    200: {
      description: "The most recent blocks, newest first",
      content: {
        "application/json": {
          schema: ListBlocksResponseSchema
        }
      }
    }
  }
});

blocksRouter.openapi(listBlocksRoute, async function routeListBlocks(c) {
  const { limit } = c.req.valid("query");
  return c.json({ data: await container.resolve(BlockQueryService).listLatest(limit) }, 200);
});

const getBlockRoute = createRoute({
  method: "get",
  path: "/v1/blocks/{height}",
  operationId: "getBlock",
  summary: "Get a block with its transactions",
  tags: ["Blocks"],
  request: {
    params: GetBlockParamsSchema
  },
  responses: {
    200: {
      description: "The block at that height with its transactions and their message types",
      content: {
        "application/json": {
          schema: GetBlockResponseSchema
        }
      }
    },
    404: {
      description: "The height is not indexed"
    }
  }
});

blocksRouter.openapi(getBlockRoute, async function routeGetBlock(c) {
  const { height } = c.req.valid("param");
  const block = await container.resolve(BlockQueryService).getByHeight(height);
  if (!block) {
    throw createError(404, "Block not found");
  }
  return c.json({ data: block }, 200);
});
