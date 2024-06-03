import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { nodeClient } from '@src/routes/v1/nodes/nodeClient';

const route = createRoute({
  method: "get",
  path: "/nodes/testnet",
  summary: "Get a list of testnet nodes (api/rpc).",
  tags: ["Chain"],
  responses: {
    200: {
      description: "List of testnet nodes",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              id: z.string(),
              api: z.string(),
              rpc: z.string()
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  return c.json(await nodeClient.getTestnetNodes());
});
