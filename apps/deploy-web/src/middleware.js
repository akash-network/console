"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
var logging_1 = require("@akashnetwork/logging");
var server_1 = require("next/server");
var MAINTENANCE_MODE = process.env.MAINTENANCE_MODE;
var logger = new logging_1.LoggerService({ name: "middleware" });
function middleware(request) {
    var maintenancePage = "/maintenance";
    var isMaintenanceMode = MAINTENANCE_MODE === "true";
    if (isMaintenanceMode && !request.nextUrl.pathname.startsWith(maintenancePage)) {
        var fromPath = request.nextUrl.pathname + request.nextUrl.search;
        logger.info({ message: "Redirecting to maintenance page from ".concat(fromPath) });
        return server_1.NextResponse.redirect(new URL("".concat(maintenancePage, "?return=").concat(encodeURIComponent(fromPath)), request.url), 307); // 307 - temporary redirect
    }
    else if (!isMaintenanceMode && request.nextUrl.pathname.startsWith(maintenancePage)) {
        var returnPath = getReturnPath(request);
        logger.info({ message: "Redirecting from maintenance page to ".concat(returnPath) });
        return server_1.NextResponse.redirect(new URL(returnPath, request.url), 307); // 307 - temporary redirect
    }
    return server_1.NextResponse.next();
}
function getReturnPath(request) {
    try {
        var returnParam = request.nextUrl.searchParams.get("return");
        var returnPath = returnParam ? decodeURIComponent(returnParam) : "/";
        return returnPath;
    }
    catch (error) {
        logger.error({ message: "Failed to get return path", error: error });
        return "/";
    }
}
exports.config = {
    matcher: ["/((?!_next|api/auth).*)(.+)", "/"]
};
