import { getSession } from "@auth0/nextjs-auth0";
import httpProxy from "http-proxy";

import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";

export default defineApiHandler({
  route: "/api/proxy/[...path]",
  async handler({ req, res, services }) {
    // removes the api prefix from url
    req.url = req.url?.replace(/^\/api\/proxy/, "");

    services.logger.info({ event: "PROXY_API_REQUEST", url: req.url });
    const session = await getSession(req, res);

    // Extract and forward only cf_clearance cookie if present
    const cookies = req.headers.cookie?.split(";").map(c => c.trim());
    const cfClearance = cookies?.find(c => c.startsWith("cf_clearance="));
    req.headers.cookie = cfClearance || "";

    if (session?.accessToken) {
      req.headers.authorization = `Bearer ${session.accessToken}`;
    }

    const proxy = httpProxy.createProxyServer({
      changeOrigin: true,
      target: services.config.BASE_API_MAINNET_URL,
      secure: false,
      autoRewrite: false,
      headers: {
        "cf-connecting-ip": String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || ""),
        traceparent: String(req.headers["sentry-trace"] || req.headers["traceparent"] || ""),
        baggage: String(req.headers["baggage"] || "")
      }
    });

    return new Promise((resolve, reject) => {
      proxy
        .once("proxyRes", () => resolve(undefined))
        .once("error", (error: Error) => {
          services.logger.error({ error, event: "PROXY_API_REQUEST_ERROR" });
          reject();
        })
        .web(req, res);
    });
  }
});

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
