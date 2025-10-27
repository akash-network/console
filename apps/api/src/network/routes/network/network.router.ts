import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { NetworkController } from "@src/network/controllers/network/network.controller";
import { GetNodesParamsSchema, GetNodesResponseSchema } from "@src/network/http-schemas/network.schema";

export const networkRouter = new OpenApiHonoHandler();

const getNodesRoute = createRoute({
  method: "get",
  path: "/v1/nodes/{network}",
  summary: "Get a list of nodes (api/rpc) for a specific network.",
  tags: ["Chain"],
  request: {
    params: GetNodesParamsSchema
  },
  responses: {
    200: {
      description: "List of nodes",
      content: {
        "application/json": {
          schema: GetNodesResponseSchema
        }
      }
    }
  }
});

networkRouter.openapi(getNodesRoute, async function routeGetNodes(c) {
  const { network } = c.req.valid("param");
  const result = await container.resolve(NetworkController).getNodes(network);

  if (result.ok) {
    return c.json(result.val);
  }

  throw result.val;
});
