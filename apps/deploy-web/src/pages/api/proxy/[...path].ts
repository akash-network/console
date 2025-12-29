import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { sentryTraceToW3C } from "@src/services/error-handler/error-handler.service";

export default defineApiHandler({
  route: "/api/proxy/[...path]",
  async handler({ req, res, services }) {
    // removes the api prefix from url
    req.url = req.url?.replace(/^\/api\/proxy/, "");

    services.logger.info({ event: "PROXY_API_REQUEST", url: req.url });
    const session = await services.getSession(req, res);

    // Extract and forward cf_clearance and unleash-session-id cookies
    const cookies = req.headers.cookie?.split(";").map(c => c.trim());
    const cfClearance = cookies?.find(c => c.startsWith("cf_clearance="));
    const unleashSessionId = cookies?.find(c => c.startsWith("unleash-session-id="));

    const cookiesToForward = [cfClearance, unleashSessionId].filter(Boolean);
    req.headers.cookie = cookiesToForward.join("; ");

    if (session?.accessToken) {
      req.headers.authorization = `Bearer ${session.accessToken}`;
    }

    const headers: Record<string, string> = {
      "cf-connecting-ip": String(req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "")
    };
    if (req.headers["sentry-trace"]) {
      const traceparent = sentryTraceToW3C(req.headers["sentry-trace"] as string);
      if (traceparent) headers["traceparent"] = traceparent;
    } else if (req.headers["traceparent"]) {
      headers["traceparent"] = req.headers["traceparent"] as string;
    }

    if (req.headers["baggage"]) {
      headers["baggage"] = req.headers["baggage"] as string;
    }

    const proxy = services.httpProxy.createProxyServer({
      changeOrigin: true,
      target: services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID),
      secure: false,
      autoRewrite: false,
      headers
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
