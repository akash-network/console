import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";

const route = createRoute({
  method: "get",
  path: "/version/testnet",
  summary: "Get testnet version.",
  description: "Provide a cached version of this file: [https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt](https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt)",
  tags: ["Chain"],
  responses: {
    200: {
      description: "Testnet version"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const response = await cacheResponse(60 * 5, cacheKeys.getTestnetVersion, async () => {
    const res = await axios.get("https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt");
    return res.data;
  });
  return c.text(response);
});
