const CSP_HEADER_ENFORCE = "Content-Security-Policy";
const CSP_HEADER_REPORT_ONLY = "Content-Security-Policy-Report-Only";
const CSP_REPORT_ENDPOINT_NAME = "csp-endpoint";
const CSP_REPORT_MAX_AGE_SECONDS = 10886400;

const NONCE_BYTE_LENGTH = 16;

const isDevelopment = process.env.NODE_ENV !== "production";

/** Google Analytics / Tag Manager endpoints the app connects to directly; these never vary by environment. */
const FIXED_VENDOR_CONNECT_ORIGINS = [
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://analytics.google.com",
  "https://www.googletagmanager.com"
];

export interface ContentSecurityPolicyInput {
  apiBaseUrl?: string;
  mainnetApiUrl?: string;
  testnetApiUrl?: string;
  sandboxApiUrl?: string;
  unleashFrontendApiUrl?: string;
  sentryDsn?: string;
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

export function toSentrySecurityReportUri(dsn?: string): string | undefined {
  if (!dsn || dsn.startsWith("/")) return undefined;

  try {
    const dsnUrl = new URL(dsn);
    const pathSegments = dsnUrl.pathname.split("/").filter(Boolean);
    const projectId = pathSegments[pathSegments.length - 1];

    if (!dsnUrl.username || !projectId) return undefined;

    const basePath = pathSegments.slice(0, -1).join("/");
    const reportUrl = new URL(dsnUrl.origin);
    reportUrl.pathname = `${basePath ? `/${basePath}` : ""}/api/${projectId}/security/`;
    reportUrl.searchParams.set("sentry_key", dsnUrl.username);

    return reportUrl.toString();
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
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https://www.googletagmanager.com", "https://www.google-analytics.com"];

  const envConnectOrigins = [
    toOrigin(input.apiBaseUrl),
    toOrigin(input.mainnetApiUrl),
    toOrigin(input.testnetApiUrl),
    toOrigin(input.sandboxApiUrl),
    toOrigin(input.unleashFrontendApiUrl),
    toOrigin(input.sentryDsn)
  ];

  const connectSrc = dedupeOrigins(["'self'", ...envConnectOrigins, ...FIXED_VENDOR_CONNECT_ORIGINS]);
  const sentrySecurityReportUri = toSentrySecurityReportUri(input.sentryDsn);

  if (isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("http://localhost:3080", "ws:");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ...(sentrySecurityReportUri ? [`report-uri ${sentrySecurityReportUri}`, `report-to ${CSP_REPORT_ENDPOINT_NAME}`] : [])
  ].join("; ");
}

export function getContentSecurityPolicyHeaderName() {
  return process.env.CSP_MODE === "enforce" ? CSP_HEADER_ENFORCE : CSP_HEADER_REPORT_ONLY;
}

export function getContentSecurityPolicyReportHeaders(input: ContentSecurityPolicyInput) {
  const sentrySecurityReportUri = toSentrySecurityReportUri(input.sentryDsn);

  if (!sentrySecurityReportUri) return [];

  return [
    {
      name: "Report-To",
      value: JSON.stringify({
        group: CSP_REPORT_ENDPOINT_NAME,
        max_age: CSP_REPORT_MAX_AGE_SECONDS,
        endpoints: [{ url: sentrySecurityReportUri }],
        include_subdomains: true
      })
    },
    {
      name: "Reporting-Endpoints",
      value: `${CSP_REPORT_ENDPOINT_NAME}="${sentrySecurityReportUri}"`
    }
  ];
}

function dedupeOrigins(origins: Array<string | undefined>) {
  return Array.from(new Set(origins.filter((origin): origin is string => Boolean(origin))));
}
