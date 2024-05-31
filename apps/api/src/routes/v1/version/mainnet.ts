import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { nodeClient } from "@src/routes/v1/nodes/nodeClient";

const route = createRoute({
  method: "get",
  path: "/version/mainnet",
  summary: "Get mainnet version.",
  description:
    "Provide a cached version of this file: [https://raw.githubusercontent.com/akash-network/net/master/mainnet/version.txt](https://raw.githubusercontent.com/akash-network/net/master/mainnet/version.txt)",
  tags: ["Chain"],
  responses: {
    200: {
      description: "Mainnet version"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  return c.text(await nodeClient.getMainnetVersion());
});
