import { LoggerService } from "@akashnetwork/logging";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const { MAINTENANCE_MODE } = process.env;
const logger = new LoggerService({ name: "middleware" });

export function middleware(request: NextRequest) {
  const maintenancePage = "/maintenance";
  const isMaintenanceMode = MAINTENANCE_MODE === "true";
  if (isMaintenanceMode && !request.nextUrl.pathname.startsWith(maintenancePage)) {
    const fromPath = request.nextUrl.pathname + request.nextUrl.search;
    logger.info({ message: `Redirecting to maintenance page from ${fromPath}` });

    return NextResponse.redirect(new URL(`${maintenancePage}?return=${encodeURIComponent(fromPath)}`, request.url), 307); // 307 - temporary redirect
  } else if (!isMaintenanceMode && request.nextUrl.pathname.startsWith(maintenancePage)) {
    const returnPath = getReturnPath(request);
    logger.info({ message: `Redirecting from maintenance page to ${returnPath}` });

    return NextResponse.redirect(new URL(returnPath, request.url), 307); // 307 - temporary redirect
  }

  const res = NextResponse.next();

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
