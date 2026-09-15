import { LoggerService } from "@akashnetwork/logging";
import { netConfig } from "@akashnetwork/net";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildContentSecurityPolicy, getContentSecurityPolicyHeaderName, getContentSecurityPolicyReportHeaders } from "./lib/csp/csp";

const logger = new LoggerService({ name: "middleware" });

const networkRpcAndApiUrls = netConfig.getSupportedNetworks().flatMap(network => [netConfig.getBaseRpcUrl(network), netConfig.getBaseAPIUrl(network)]);

/** A service worker script served as a redirect fails registration outright, so the maintenance redirect has to let the PWA assets through. */
const PWA_ASSET_PATHNAME = /^\/(sw\.js|workbox-[^/]+\.js|manifest\.json)$/;

export function middleware(request: NextRequest) {
  const contentSecurityPolicyInput = {
    mainnetApiUrl: process.env.NEXT_PUBLIC_BASE_API_MAINNET_URL,
    testnetApiUrl: process.env.NEXT_PUBLIC_BASE_API_TESTNET_URL,
    sandboxApiUrl: process.env.NEXT_PUBLIC_BASE_API_SANDBOX_URL,
    providerProxyUrl: process.env.NEXT_PUBLIC_PROVIDER_PROXY_URL,
    amplitudeProxyUrl: process.env.NEXT_PUBLIC_AMPLITUDE_PROXY_URL,
    unleashFrontendApiUrl: process.env.NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    templatesUrl: process.env.NEXT_PUBLIC_BASE_TEMPLATES_URL,
    networkRpcAndApiUrls
  };
  const contentSecurityPolicy = buildContentSecurityPolicy(contentSecurityPolicyInput);
  const contentSecurityPolicyHeaderName = getContentSecurityPolicyHeaderName();
  const contentSecurityPolicyReportHeaders = getContentSecurityPolicyReportHeaders(contentSecurityPolicyInput);

  const maintenancePage = "/maintenance";
  const { pathname } = request.nextUrl;
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";
  const shouldRedirectToMaintenance = isMaintenanceMode && !pathname.startsWith(maintenancePage) && !PWA_ASSET_PATHNAME.test(pathname);

  if (shouldRedirectToMaintenance) {
    const fromPath = pathname + request.nextUrl.search;
    logger.info({ message: `Redirecting to maintenance page from ${fromPath}` });

    const redirectResponse = NextResponse.redirect(new URL(`${maintenancePage}?return=${encodeURIComponent(fromPath)}`, request.url), 307); // 307 - temporary redirect
    setContentSecurityPolicyHeaders(redirectResponse, contentSecurityPolicyHeaderName, contentSecurityPolicy, contentSecurityPolicyReportHeaders);
    return redirectResponse;
  } else if (!isMaintenanceMode && pathname.startsWith(maintenancePage)) {
    const returnUrl = getReturnPath(request);
    logger.info({ message: `Redirecting from maintenance page to ${returnUrl.pathname}${returnUrl.search}` });

    const redirectResponse = NextResponse.redirect(returnUrl, 307); // 307 - temporary redirect
    setContentSecurityPolicyHeaders(redirectResponse, contentSecurityPolicyHeaderName, contentSecurityPolicy, contentSecurityPolicyReportHeaders);
    return redirectResponse;
  }

  const res = NextResponse.next();
  setContentSecurityPolicyHeaders(res, contentSecurityPolicyHeaderName, contentSecurityPolicy, contentSecurityPolicyReportHeaders);

  const cookieName = "unleash-session-id";
  let sessionId = request.cookies.get(cookieName)?.value;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookies.set(cookieName, sessionId, {
      path: "/",
      httpOnly: false, // MUST be readable on the client
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });
  }

  return res;
}

function setContentSecurityPolicyHeaders(
  response: NextResponse,
  contentSecurityPolicyHeaderName: string,
  contentSecurityPolicy: string,
  reportHeaders: Array<{ name: string; value: string }>
) {
  response.headers.set(contentSecurityPolicyHeaderName, contentSecurityPolicy);
  reportHeaders.forEach(header => {
    response.headers.set(header.name, header.value);
  });
}

function getReturnPath(request: NextRequest) {
  const requestUrl = new URL(request.url);
  try {
    const returnParam = request.nextUrl.searchParams.get("return");
    const returnPath = returnParam ? decodeURIComponent(returnParam) : "/";
    const returnUrl = new URL(returnPath, requestUrl);
    const isSameOrigin = returnUrl.origin === requestUrl.origin;

    // Return the validated same-origin URL object rather than a pathname string.
    // A same-origin absolute return (e.g. `http://host//evil.example/phish`) yields a
    // pathname of `//evil.example/phish`; re-parsing that string against the request URL
    // treats it as a protocol-relative URL and escapes to an external origin (CWE-601).
    return isSameOrigin ? returnUrl : new URL("/", requestUrl);
  } catch (error) {
    logger.error({ message: "Failed to get return path", error });
    return new URL("/", requestUrl);
  }
}

export const config = {
  matcher: ["/((?!_next|api/auth).*)(.+)", "/"]
};
