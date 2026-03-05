import { container } from "tsyringe";

import { BlockPredictionController } from "@src/block/controllers/block-prediction/block-prediction.controller";
import {
  GetPredictedBlockDateParamsSchema,
  GetPredictedBlockDateResponseSchema,
  GetPredictedDateHeightParamsSchema,
  GetPredictedDateHeightResponseSchema,
  GetPredictionQuerySchema
} from "@src/block/http-schemas/block-prediction.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const blockPredictionRouter = new OpenApiHonoHandler();

const getPredictedBlockDateRoute = createRoute({
  method: "get",
  path: "/v1/predicted-block-date/{height}",
  summary: "Get the estimated date of a future block.",
  tags: ["Blocks"],
  security: SECURITY_NONE,
  request: {
    params: GetPredictedBlockDateParamsSchema,
    query: GetPredictionQuerySchema
  },
  responses: {
    200: {
      description: "Returns predicted block date",
      content: {
        "application/json": {
          schema: GetPredictedBlockDateResponseSchema
        }
      }
    },
    400: {
      description: "Invalid height or block window"
    }
  }
});
blockPredictionRouter.openapi(getPredictedBlockDateRoute, async function routeGetPredictedBlockDate(c) {
  const { height } = c.req.valid("param");
  const { blockWindow } = c.req.valid("query");
  const response = await container.resolve(BlockPredictionController).getPredictedBlockDate(height, blockWindow);

  return c.json(response);
});

const getPredictedDateHeightRoute = createRoute({
  method: "get",
  path: "/v1/predicted-date-height/{timestamp}",
  summary: "Get the estimated height of a future date and time.",
  tags: ["Blocks"],
  security: SECURITY_NONE,
  request: {
    params: GetPredictedDateHeightParamsSchema,
    query: GetPredictionQuerySchema
  },
  responses: {
    200: {
      description: "Returns predicted block height",
      content: {
        "application/json": {
          schema: GetPredictedDateHeightResponseSchema
        }
      }
    },
    400: {
      description: "Invalid timestamp or block window"
    }
  }
});
blockPredictionRouter.openapi(getPredictedDateHeightRoute, async function routeGetPredictedDateHeight(c) {
  const { timestamp } = c.req.valid("param");
  const { blockWindow } = c.req.valid("query");
  const response = await container.resolve(BlockPredictionController).getPredictedDateHeight(timestamp, blockWindow);

  return c.json(response);
});
