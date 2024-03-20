import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";

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
  const response = await cacheResponse(60 * 5, cacheKeys.getMainnetVersion, async () => {
    const res = await axios.get<string>("https://raw.githubusercontent.com/akash-network/net/master/mainnet/version.txt");
    return res.data;
  });
  return c.text(response);
});
