import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { nodeClient } from "@src/routes/v1/nodes/nodeClient";

const route = createRoute({
  method: "get",
  path: "/version/testnet",
  summary: "Get testnet version.",
  description:
    "Provide a cached version of this file: [https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt](https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt)",
  tags: ["Chain"],
  responses: {
    200: {
      description: "Testnet version"
    }
  }
});
export default new OpenAPIHono().openapi(route, async c => {
  return c.text(await nodeClient.getTestnetVersion());
});
