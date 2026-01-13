import { defineApiHandler } from "@src/lib/nextjs/defineApiHandler/defineApiHandler";
import type { AppServices } from "@src/services/app-di-container/server-di-container.service";

let amplitudeProxy: ReturnType<AppServices["httpProxy"]["createProxyServer"]> | null = null;

function getAmplitudeProxy(services: AppServices) {
  if (!amplitudeProxy) {
    amplitudeProxy = services.httpProxy.createProxyServer({
      changeOrigin: true,
      target: "https://api2.amplitude.com",
      secure: true,
      autoRewrite: false
    });
  }

  return amplitudeProxy;
}

export default defineApiHandler({
  route: "/api/collect",
  async handler({ req, res, services }) {
    delete req.headers.cookie;

    req.url = "/2/httpapi";

    const proxy = getAmplitudeProxy(services);

    return new Promise<void>((resolve, reject) => {
      const onProxyRes = (_proxyRes: unknown, _req: unknown, proxyRes: unknown) => {
        if (proxyRes === res) {
          proxy.off("error", onError);
          resolve();
        }
      };
      const onError = (error: Error, _req: unknown, errorRes: unknown) => {
        if (errorRes === res) {
          proxy.off("proxyRes", onProxyRes);
          services.logger.error({ error, event: "AMPLITUDE_PROXY_ERROR" });
          if (!res.headersSent) {
            res.status(502).json({ error: "Proxy error" });
          }
          reject(error);
        }
      };
      proxy.on("proxyRes", onProxyRes);
      proxy.on("error", onError);
      proxy.web(req, res);
    });
  }
});

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false
  }
};
