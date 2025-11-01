import { browserEnvConfig } from "@src/config/browser-env.config";

export const providerProxyUrlWs = constructUrl(browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL);

function constructUrl(input: string): string {
  if (typeof window === "undefined" || !input.startsWith("/")) {
    return input;
  }

  const url = new URL(input, window.location.origin);
  url.protocol = url.protocol.replace("http", "ws");

  return url.toString();
}
