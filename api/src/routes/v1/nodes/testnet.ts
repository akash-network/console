import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";

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
  const response = await cacheResponse(60 * 2, cacheKeys.getTestnetNodes, async () => {
    const res = await axios.get<{ id: string; api: string; rpc: string }[]>(
      "https://raw.githubusercontent.com/akash-network/cloudmos/main/config/testnet-nodes.json"
    );
    return res.data;
  });
  return c.json(response);
});
