import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { nodeClient } from "@src/routes/v1/nodes/nodeClient";

const route = createRoute({
  method: "get",
  path: "/version/sandbox",
  summary: "Get sandbox version.",
  description:
    "Provide a cached version of this file: [https://raw.githubusercontent.com/akash-network/net/master/sandbox/version.txt](https://raw.githubusercontent.com/akash-network/net/master/sandbox/version.txt)",
  tags: ["Chain"],
  responses: {
    200: {
      description: "Sandbox version"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  return c.text(await nodeClient.getSandboxVersion());
});
