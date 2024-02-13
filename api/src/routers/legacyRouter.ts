import { Hono } from "hono";

export const legacyRouter = new Hono();

const redirectStatusCode = 302; // Temporary Redirect

legacyRouter.get("/predicted-block-date/:height/:blockWindow?", async (c) => {
  const height = c.req.param("height");
  const blockWindow = c.req.param("blockWindow");

  return c.redirect(`/v1/predicted-block-date/${height}${blockWindow ? `?blockWindow=${blockWindow}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/predicted-date-height/:date/:blockWindow?", async (c) => {
  const date = c.req.param("date");
  const blockWindow = c.req.param("blockWindow");

  return c.redirect(`/v1/predicted-date-height/${date}${blockWindow ? `?blockWindow=${blockWindow}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/getNetworkCapacity", async (c) => {
  return c.redirect("/v1/network-capacity", redirectStatusCode);
});

legacyRouter.get("/marketData", async (c) => {
  return c.redirect("/v1/market-data", redirectStatusCode);
});

legacyRouter.get("/dashboardData", async (c) => {
  return c.redirect("/v1/dashboard-data", redirectStatusCode);
});

legacyRouter.get("/getAuditors", async (c) => {
  return c.redirect("/v1/auditors", redirectStatusCode);
});

legacyRouter.get("/getMainnetNodes", async (c) => {
  return c.redirect("/v1/nodes/mainnet", redirectStatusCode);
});

legacyRouter.get("/getSandboxNodes", async (c) => {
  return c.redirect("/v1/nodes/sandbox", redirectStatusCode);
});

legacyRouter.get("/getTestnetNodes", async (c) => {
  return c.redirect("/v1/nodes/testnet", redirectStatusCode);
});

legacyRouter.get("/getProviderAttributesSchema", async (c) => {
  return c.redirect("/v1/provider-attributes-schema", redirectStatusCode);
});

legacyRouter.get("/getMainnetVersion", async (c) => {
  return c.redirect("/v1/version/mainnet", redirectStatusCode);
});

legacyRouter.get("/getSandboxVersion", async (c) => {
  return c.redirect("/v1/version/sandbox", redirectStatusCode);
});

legacyRouter.get("/getTestnetVersion", async (c) => {
  return c.redirect("/v1/version/testnet", redirectStatusCode);
});

legacyRouter.get("/getProviderGraphData/:dataName", async (c) => {
  const dataName = c.req.param("dataName");
  return c.redirect(`/v1/provider-graph-data/${dataName}`, redirectStatusCode);
});

legacyRouter.get("/getProviderActiveLeasesGraphData/:address", async (c) => {
  const address = c.req.param("address");
  return c.redirect(`/v1/provider-active-leases-graph-data/${address}`, redirectStatusCode);
});

legacyRouter.get("/getGraphData/:dataName", async (c) => {
  const dataName = c.req.param("dataName");
  return c.redirect(`/v1/graph-data/${dataName}`, redirectStatusCode);
});
