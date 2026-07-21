import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createLogger } from "./lib/createLogger/createLogger";
import { buildContentSecurityPolicy, generateNonce, getContentSecurityPolicyHeaderName, getContentSecurityPolicyReportHeaders } from "./lib/csp/csp";

const { MAINTENANCE_MODE } = process.env;
const logger = createLogger({ name: "middleware" });

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const contentSecurityPolicyInput = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    mainnetApiUrl: process.env.NEXT_PUBLIC_BASE_API_MAINNET_URL,
    testnetApiUrl: process.env.NEXT_PUBLIC_BASE_API_TESTNET_URL,
    sandboxApiUrl: process.env.NEXT_PUBLIC_BASE_API_SANDBOX_URL,
    unleashFrontendApiUrl: process.env.NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN
  };
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, contentSecurityPolicyInput);
  const contentSecurityPolicyHeaderName = getContentSecurityPolicyHeaderName();
  const contentSecurityPolicyReportHeaders = getContentSecurityPolicyReportHeaders(contentSecurityPolicyInput);

  const maintenancePage = "/maintenance";
  const isMaintenanceMode = MAINTENANCE_MODE === "true";
  if (isMaintenanceMode && !request.nextUrl.pathname.startsWith(maintenancePage)) {
    const fromPath = request.nextUrl.pathname + request.nextUrl.search;
    logger.info({ message: `Redirecting to maintenance page from ${fromPath}` });

    const redirectResponse = NextResponse.redirect(new URL(`${maintenancePage}?return=${encodeURIComponent(fromPath)}`, request.url), 307); // 307 - temporary redirect
    setContentSecurityPolicyHeaders(redirectResponse, contentSecurityPolicyHeaderName, contentSecurityPolicy, contentSecurityPolicyReportHeaders);
    return redirectResponse;
  } else if (!isMaintenanceMode && request.nextUrl.pathname.startsWith(maintenancePage)) {
    const returnPath = getReturnPath(request);
    logger.info({ message: `Redirecting from maintenance page to ${returnPath}` });

    const redirectResponse = NextResponse.redirect(new URL(returnPath, request.url), 307); // 307 - temporary redirect
    setContentSecurityPolicyHeaders(redirectResponse, contentSecurityPolicyHeaderName, contentSecurityPolicy, contentSecurityPolicyReportHeaders);
    return redirectResponse;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(contentSecurityPolicyHeaderName, contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  setContentSecurityPolicyHeaders(response, contentSecurityPolicyHeaderName, contentSecurityPolicy, contentSecurityPolicyReportHeaders);
  return response;
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
