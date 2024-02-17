import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";

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
  const response = await cacheResponse(60 * 5, cacheKeys.getSandboxVersion, async () => {
    const res = await axios.get("https://raw.githubusercontent.com/akash-network/net/master/sandbox/version.txt");
    return res.data;
  });
  return c.text(response);
});
