import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import { proxyRequest } from "@src/lib/nextjs/proxyRequest/proxyRequest";
import { sentryTraceToW3C } from "@src/services/error-handler/error-handler.service";

export default defineApiHandler({
  route: "/api/proxy/[...path]",
  async handler({ req, res, services }) {
    services.logger.info({ event: "PROXY_API_REQUEST", url: req.url });
    const url = req.url?.replace(/^\/api\/proxy\//, "/") || "";

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

    const session = await services.getSession(req, res);

    // Extract and forward cf_clearance and unleash-session-id cookies
    const cookiesToForward = req.headers.cookie
      ?.split(";")
      .map(c => c.trim())
      .filter(c => c.startsWith("cf_clearance=") || c.startsWith("unleash-session-id="));

    if (cookiesToForward?.length) {
      headers.cookie = cookiesToForward.join("; ");
    }

    if (session?.accessToken) {
      headers.authorization = `Bearer ${session.accessToken}`;
    }

    await proxyRequest(req, res, {
      target: services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID) + url,
      headers,
      onError: error => {
        services.logger.error({ event: "PROXY_API_REQUEST_ERROR", error });
      }
    });
  }
});

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
