import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createLogger } from "./lib/createLogger/createLogger";

const { MAINTENANCE_MODE } = process.env;
const logger = createLogger({ name: "middleware" });

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

  return NextResponse.next();
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
