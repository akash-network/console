import { Hono } from "hono";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { getWeb3IndexRevenue } from "@src/services/db/networkRevenueService";

export const web3IndexRouter = new Hono();

web3IndexRouter.get("/revenue", async c => {
  console.log("calculating revenue");

  const isDebug = c.req.query("debug") === "true";

  const revenueData = isDebug ? await getWeb3IndexRevenue(true) : await cacheResponse(60 * 30, cacheKeys.web3IndexRevenue, getWeb3IndexRevenue);

  return c.json(revenueData);
});
