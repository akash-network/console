import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { NetworkController } from "@src/network/controllers/network/network.controller";
import { GetNodesParamsSchema, GetNodesResponseSchema } from "@src/network/http-schemas/network.schema";

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

const getVersionRoute = createRoute({
  method: "get",
  path: "/v1/version/{network}",
  summary: "Get network version.",
  description:
    "Provide a cached version of one of these files: [https://raw.githubusercontent.com/akash-network/net/master/mainnet/version.txt](https://raw.githubusercontent.com/akash-network/net/master/mainnet/version.txt), [https://raw.githubusercontent.com/akash-network/net/master/sandbox/version.txt](https://raw.githubusercontent.com/akash-network/net/master/sandbox/version.txt), [https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt](https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt)",
  tags: ["Chain"],
  request: {
    params: GetNodesParamsSchema
  },
  responses: {
    200: {
      description: "Network version"
    }
  }
});

export const networkRouter = new OpenApiHonoHandler();

networkRouter.openapi(getNodesRoute, async function routeGetNodes(c) {
  const { network } = c.req.valid("param");
  const response = await container.resolve(NetworkController).getNodes(network);

  return c.json(response);
});

networkRouter.openapi(getVersionRoute, async function routeGetVersion(c) {
  const { network } = c.req.valid("param");
  const response = await container.resolve(NetworkController).getVersion(network);

  return c.text(response);
});
