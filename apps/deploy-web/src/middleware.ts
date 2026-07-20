import { LoggerService } from "@akashnetwork/logging";
import { netConfig } from "@akashnetwork/net";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildContentSecurityPolicy, generateNonce, getContentSecurityPolicyHeaderName } from "./lib/csp/csp";

const { MAINTENANCE_MODE } = process.env;
const logger = new LoggerService({ name: "middleware" });

const networkRpcAndApiUrls = netConfig.getSupportedNetworks().flatMap(network => [netConfig.getBaseRpcUrl(network), netConfig.getBaseAPIUrl(network)]);

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, {
    mainnetApiUrl: process.env.NEXT_PUBLIC_BASE_API_MAINNET_URL,
    testnetApiUrl: process.env.NEXT_PUBLIC_BASE_API_TESTNET_URL,
    sandboxApiUrl: process.env.NEXT_PUBLIC_BASE_API_SANDBOX_URL,
    providerProxyUrl: process.env.NEXT_PUBLIC_PROVIDER_PROXY_URL,
    amplitudeProxyUrl: process.env.NEXT_PUBLIC_AMPLITUDE_PROXY_URL,
    unleashFrontendApiUrl: process.env.NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    templatesUrl: process.env.NEXT_PUBLIC_BASE_TEMPLATES_URL,
    networkRpcAndApiUrls
  });
  const contentSecurityPolicyHeaderName = getContentSecurityPolicyHeaderName();

  const maintenancePage = "/maintenance";
  const isMaintenanceMode = MAINTENANCE_MODE === "true";
  if (isMaintenanceMode && !request.nextUrl.pathname.startsWith(maintenancePage)) {
    const fromPath = request.nextUrl.pathname + request.nextUrl.search;
    logger.info({ message: `Redirecting to maintenance page from ${fromPath}` });

    const redirectResponse = NextResponse.redirect(new URL(`${maintenancePage}?return=${encodeURIComponent(fromPath)}`, request.url), 307); // 307 - temporary redirect
    redirectResponse.headers.set(contentSecurityPolicyHeaderName, contentSecurityPolicy);
    return redirectResponse;
  } else if (!isMaintenanceMode && request.nextUrl.pathname.startsWith(maintenancePage)) {
    const returnPath = getReturnPath(request);
    logger.info({ message: `Redirecting from maintenance page to ${returnPath}` });

    const redirectResponse = NextResponse.redirect(new URL(returnPath, request.url), 307); // 307 - temporary redirect
    redirectResponse.headers.set(contentSecurityPolicyHeaderName, contentSecurityPolicy);
    return redirectResponse;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(contentSecurityPolicyHeaderName, contentSecurityPolicy);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(contentSecurityPolicyHeaderName, contentSecurityPolicy);

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

function getReturnPath(request: NextRequest) {
  try {
    const returnParam = request.nextUrl.searchParams.get("return");
    const returnPath = returnParam ? decodeURIComponent(returnParam) : "/";

    return returnPath;
  } catch (error) {
    logger.error({ message: "Failed to get return path", error });
    return "/";
  }
}

export const config = {
  matcher: ["/((?!_next|api/auth).*)(.+)", "/"]
};
