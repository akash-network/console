import type { Context } from "hono";
import { Hono } from "hono";

export const legacyRouter = new Hono();

const redirectStatusCode = 302; // Temporary Redirect

legacyRouter.get("/blocks", async c => {
  const limit = c.req.query("limit");
  return c.redirect(`/v1/blocks${limit ? `?limit=${limit}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/blocks/:height", async c => {
  const height = c.req.param("height");
  return c.redirect(`/v1/blocks/${height}`, redirectStatusCode);
});

legacyRouter.get("/predicted-block-date/:height/:blockWindow?", async c => {
  const height = c.req.param("height");
  const blockWindow = c.req.param("blockWindow");

  return c.redirect(`/v1/predicted-block-date/${height}${blockWindow ? `?blockWindow=${blockWindow}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/predicted-date-height/:date/:blockWindow?", async c => {
  const date = c.req.param("date");
  const blockWindow = c.req.param("blockWindow");

  return c.redirect(`/v1/predicted-date-height/${date}${blockWindow ? `?blockWindow=${blockWindow}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/transactions", async c => {
  const limit = c.req.query("limit");
  return c.redirect(`/v1/transactions${limit ? `?limit=${limit}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/transactions/:hash", async c => {
  const hash = c.req.param("hash");
  return c.redirect(`/v1/transactions/${hash}`, redirectStatusCode);
});

legacyRouter.get("/addresses/:address", async c => {
  const address = c.req.param("address");
  return c.redirect(`/v1/addresses/${address}`, redirectStatusCode);
});

legacyRouter.get("/addresses/:address/transactions/:skip/:limit", async c => {
  const address = c.req.param("address");
  const skip = c.req.param("skip");
  const limit = c.req.param("limit");
  return c.redirect(`/v1/addresses/${address}/transactions/${skip}/${limit}`, redirectStatusCode);
});

legacyRouter.get("/addresses/:address/deployments/:skip/:limit", async c => {
  const address = c.req.param("address");
  const skip = c.req.param("skip");
  const limit = c.req.param("limit");
  const status = c.req.query("status");
  const reverseSorting = c.req.query("reverseSorting");

  const urlParams = new URLSearchParams("");

  if (status) {
    urlParams.append("status", status);
  }

  if (reverseSorting) {
    urlParams.append("reverseSorting", reverseSorting);
  }

  const q = urlParams.toString();

  return c.redirect(`/v1/addresses/${address}/deployments/${skip}/${limit}${q ? "?" + q : ""}`, redirectStatusCode);
});

legacyRouter.get("/providers/:address", async c => {
  const address = c.req.param("address");
  return c.redirect(`/v1/providers/${address}`, redirectStatusCode);
});

legacyRouter.get("/providers", async c => {
  return c.redirect("/v1/providers", redirectStatusCode);
});

legacyRouter.get("/providers/:provider/deployments/:skip/:limit/:status?", async c => {
  const provider = c.req.param("provider");
  const skip = c.req.param("skip");
  const limit = c.req.param("limit");
  const status = c.req.param("status");
  return c.redirect(`/v1/providers/${provider}/deployments/${skip}/${limit}${status ? `?status=${status}` : ""}`, redirectStatusCode);
});

legacyRouter.get("/provider-attributes-schema", async c => {
  return c.redirect("/v1/provider-attributes-schema", redirectStatusCode);
});

legacyRouter.get("/provider-regions", async c => {
  return c.redirect("/v1/provider-regions", redirectStatusCode);
});

legacyRouter.get("/validators", async c => {
  return c.redirect("/v1/validators", redirectStatusCode);
});

legacyRouter.get("/validators/:address", async c => {
  const address = c.req.param("address");
  return c.redirect(`/v1/validators/${address}`, redirectStatusCode);
});

legacyRouter.get("/proposals", async c => {
  return c.redirect("/v1/proposals", redirectStatusCode);
});

legacyRouter.get("/proposals/:id", async c => {
  const id = c.req.param("id");
  return c.redirect(`/v1/proposals/${id}`, redirectStatusCode);
});

legacyRouter.get("/templates", async c => {
  return c.redirect("/v1/templates", redirectStatusCode);
});

legacyRouter.get("/getNetworkCapacity", async c => {
  return c.redirect("/v1/network-capacity", redirectStatusCode);
});

legacyRouter.get("/marketData", async c => {
  return c.redirect("/v1/market-data", redirectStatusCode);
});

legacyRouter.get("/dashboardData", async c => {
  return c.redirect("/v1/dashboard-data", redirectStatusCode);
});

legacyRouter.post("/pricing", proxyToV1);

legacyRouter.get("/getAuditors", async c => {
  return c.redirect("/v1/auditors", redirectStatusCode);
});

legacyRouter.get("/getMainnetNodes", async c => {
  return c.redirect("/v1/nodes/mainnet", redirectStatusCode);
});

legacyRouter.get("/getSandboxNodes", async c => {
  return c.redirect("/v1/nodes/sandbox", redirectStatusCode);
});

legacyRouter.get("/getTestnetNodes", async c => {
  return c.redirect("/v1/nodes/testnet", redirectStatusCode);
});

legacyRouter.get("/getProviderAttributesSchema", async c => {
  return c.redirect("/v1/provider-attributes-schema", redirectStatusCode);
});

legacyRouter.get("/getMainnetVersion", async c => {
  return c.redirect("/v1/version/mainnet", redirectStatusCode);
});

legacyRouter.get("/getSandboxVersion", async c => {
  return c.redirect("/v1/version/sandbox", redirectStatusCode);
});

legacyRouter.get("/getTestnetVersion", async c => {
  return c.redirect("/v1/version/testnet", redirectStatusCode);
});

legacyRouter.get("/deployment/:owner/:dseq", async c => {
  const owner = c.req.param("owner");
  const dseq = c.req.param("dseq");
  return c.redirect(`/v1/deployment/${owner}/${dseq}`, redirectStatusCode);
});

legacyRouter.get("/getProviderGraphData/:dataName", async c => {
  const dataName = c.req.param("dataName");
  return c.redirect(`/v1/provider-graph-data/${dataName}`, redirectStatusCode);
});

legacyRouter.get("/getProviderActiveLeasesGraphData/:address", async c => {
  const address = c.req.param("address");
  return c.redirect(`/v1/providers/${address}/active-leases-graph-data`, redirectStatusCode);
});

legacyRouter.get("/getGraphData/:dataName", async c => {
  const dataName = c.req.param("dataName");
  return c.redirect(`/v1/graph-data/${dataName}`, redirectStatusCode);
});

legacyRouter.get("/v1/templates-list.json", async c => {
  return c.redirect("/v1/templates-list", redirectStatusCode);
});

legacyRouter.get("/v1/templates/:id{.+\\.json}", async c => {
  const id = c.req.param("id");
  const templateId = id.slice(0, -5); // Remove ".json" suffix
  const queryString = new URL(c.req.url).search;
  return c.redirect(`/v1/templates/${templateId}${queryString}`, redirectStatusCode);
});

legacyRouter.post("/user/subscribeToNewsletter", proxyToV1);

legacyRouter.get("/user/byUsername/:username", async c => {
  const username = c.req.param("username");
  return c.redirect(`/v1/user/byUsername/${username}`, 301);
});

legacyRouter.get("/user/checkUsernameAvailability/:username", async c => {
  const username = c.req.param("username");
  return c.redirect(`/v1/user/checkUsernameAvailability/${username}`, 301);
});

legacyRouter.put("/user/updateSettings", proxyToV1);

legacyRouter.get("/user/template/:id", async c => {
  const id = c.req.param("id");
  return c.redirect(`/v1/user/template/${id}`, 301);
});

legacyRouter.get("/user/templates/:username", async c => {
  const username = c.req.param("username");
  return c.redirect(`/v1/user/templates/${username}`, 301);
});

legacyRouter.delete("/user/deleteTemplate/:id", proxyToV1);

legacyRouter.get("/user/favoriteTemplates", async c => {
  return c.redirect("/v1/user/favoriteTemplates", 301);
});

legacyRouter.post("/user/saveTemplate", proxyToV1);

legacyRouter.post("/user/saveTemplateDesc", proxyToV1);

legacyRouter.post("/user/addFavoriteTemplate/:id", proxyToV1);

legacyRouter.delete("/user/removeFavoriteTemplate/:id", proxyToV1);

/**
 * Local http proxy to http://127.0.0.1:3000/v1/*
 */
function proxyToV1(c: Context) {
  const originalUrl = new URL(c.req.url);
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/v1${originalUrl.pathname}${originalUrl.search}`;

  return fetch(new Request(url, c.req.raw));
}
