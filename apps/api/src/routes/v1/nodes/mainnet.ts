import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { nodeClient } from '@src/routes/v1/nodes/nodeClient';

const route = createRoute({
  method: "get",
  path: "/nodes/mainnet",
  summary: "Get a list of mainnet nodes (api/rpc).",
  tags: ["Chain"],
  responses: {
    200: {
      description: "List of mainnet nodes",
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
  return c.json(await nodeClient.getMainnetNodes());
});
