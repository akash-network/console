import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";

const route = createRoute({
  method: "get",
  path: "/nodes/sandbox",
  summary: "Get a list of sandbox nodes (api/rpc).",
  tags: ["Chain"],
  responses: {
    200: {
      description: "List of sandbox nodes",
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
  const response = await cacheResponse(60 * 2, cacheKeys.getSandboxNodes, async () => {
    const res = await axios.get<{ id: string; api: string; rpc: string }[]>(
      "https://raw.githubusercontent.com/akash-network/cloudmos/main/config/sandbox-nodes.json"
    );
    return res.data;
  });
  return c.json(response);
});
