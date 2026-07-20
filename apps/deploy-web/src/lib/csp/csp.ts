const CSP_HEADER_ENFORCE = "Content-Security-Policy";
const CSP_HEADER_REPORT_ONLY = "Content-Security-Policy-Report-Only";

const NONCE_BYTE_LENGTH = 16;

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Third-party endpoints the app connects to directly (Stripe, Cloudflare, Google, Growth Channel, Amplitude); these never vary by environment.
 * Amplitude core events are proxied via NEXT_PUBLIC_AMPLITUDE_PROXY_URL, but Session Replay (config + ingest) and the no-proxy fallback hit
 * `*.amplitude.com` subdomains directly, so the wildcard is required regardless of the proxy setting.
 */
const FIXED_VENDOR_CONNECT_ORIGINS = [
  "https://api.stripe.com",
  "https://m.stripe.network",
  "https://challenges.cloudflare.com",
  "https://www.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://pxl.growth-channel.net",
  "https://*.amplitude.com"
];

/** Image hosts that never vary by environment (inline data/blob URIs, GitHub avatars/raw content, Google). */
const FIXED_IMG_SRC = ["data:", "blob:", "https://raw.githubusercontent.com", "https://avatars.githubusercontent.com", "https://www.googletagmanager.com", "https://*.google-analytics.com"];

export interface ContentSecurityPolicyInput {
  mainnetApiUrl?: string;
  testnetApiUrl?: string;
  sandboxApiUrl?: string;
  providerProxyUrl?: string;
  amplitudeProxyUrl?: string;
  unleashFrontendApiUrl?: string;
  sentryDsn?: string;
  templatesUrl?: string;
  networkRpcAndApiUrls?: string[];
}

/**
 * Reduces a configured URL (which may carry a path, e.g. an Unleash frontend endpoint or a Sentry DSN) to a bare origin.
 * Returns undefined for empty, relative (`/...`), or unparseable values: relative endpoints are same-origin and already
 * covered by `'self'`.
 */
export function toOrigin(value?: string): string | undefined {
  if (!value || value.startsWith("/")) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * Uses Web Crypto (available on the Edge/standard middleware runtime) since Node's
 * `crypto` module is not guaranteed to be available where the middleware executes.
 */
export function generateNonce() {
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildContentSecurityPolicy(nonce: string, input: ContentSecurityPolicyInput) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://www.googletagmanager.com",
    "https://pxl.growth-channel.net",
    "https://challenges.cloudflare.com",
    "https://js.stripe.com"
  ];

  const providerProxyOrigin = toOrigin(input.providerProxyUrl);
  const providerProxyWebSocketOrigin = providerProxyOrigin?.replace(/^http/, "ws");

  const envConnectOrigins = [
    toOrigin(input.mainnetApiUrl),
    toOrigin(input.testnetApiUrl),
    toOrigin(input.sandboxApiUrl),
    providerProxyOrigin,
    providerProxyWebSocketOrigin,
    toOrigin(input.amplitudeProxyUrl),
    toOrigin(input.unleashFrontendApiUrl),
    toOrigin(input.sentryDsn),
    ...(input.networkRpcAndApiUrls ?? []).map(toOrigin)
  ];

  const connectSrc = dedupeOrigins(["'self'", ...envConnectOrigins, ...FIXED_VENDOR_CONNECT_ORIGINS]);
  const imgSrc = dedupeOrigins(["'self'", ...FIXED_IMG_SRC, toOrigin(input.templatesUrl)]);

  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("http://localhost:3080", "ws:");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"])
  ].join("; ");
}

export function getContentSecurityPolicyHeaderName() {
  return process.env.CSP_MODE === "enforce" ? CSP_HEADER_ENFORCE : CSP_HEADER_REPORT_ONLY;
}

function dedupeOrigins(origins: Array<string | undefined>) {
  return Array.from(new Set(origins.filter((origin): origin is string => Boolean(origin))));
}
