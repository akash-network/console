import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const { MAINTENANCE_MODE } = process.env;

export function middleware(request: NextRequest) {
  const maintenancePage = "/maintenance";
  if (MAINTENANCE_MODE && !request.nextUrl.pathname.startsWith(maintenancePage)) {
    const fromPath = request.nextUrl.pathname + request.nextUrl.search;
    console.log("Redirecting to maintenance page from " + fromPath);

    return NextResponse.redirect(new URL(`${maintenancePage}?return=${encodeURIComponent(fromPath)}`, request.url), 307); // 307 - temporary redirect
  } else if (!MAINTENANCE_MODE && request.nextUrl.pathname.startsWith(maintenancePage)) {
    const returnPath = getReturnPath(request);
    console.log("Redirecting from maintenance page to " + returnPath);

    return NextResponse.redirect(new URL(returnPath, request.url), 307); // 307 - temporary redirect
  }

  return NextResponse.next();
}

function getReturnPath(request: NextRequest) {
  try {
    const returnParam = request.nextUrl.searchParams.get("return");
    const returnPath = returnParam ? decodeURIComponent(returnParam) : "/";

    return returnPath;
  } catch (err) {
    console.error(err);
    return "/";
  }
}

export const config = {
  matcher: ["/((?!_next|api/auth).*)(.+)", "/"]
};
