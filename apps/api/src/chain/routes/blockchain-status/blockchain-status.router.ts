import { container } from "tsyringe";
import { z } from "zod";

import { BlockchainStatusController } from "@src/chain/controllers/blockchain-status/blockchain-status.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

const blockchainStatusResponseSchema = z.object({
  isBlockchainReachable: z.boolean().openapi({ description: "Whether the console can reach the Akash Network right now." })
});

const route = createRoute({
  method: "get",
  path: "/v1/blockchain-status",
  summary: "Get Akash Network reachability status",
  tags: ["Network"],
  security: SECURITY_NONE,
  request: {},
  responses: {
    200: {
      description: "Returns whether the Akash Network is reachable",
      content: {
        "application/json": {
          schema: blockchainStatusResponseSchema
        }
      }
    }
  }
});

export const blockchainStatusRouter = new OpenApiHonoHandler();

blockchainStatusRouter.openapi(route, async function routeGetBlockchainStatus(c) {
  const result = await container.resolve(BlockchainStatusController).getStatus();
  return c.json(result, 200);
});
