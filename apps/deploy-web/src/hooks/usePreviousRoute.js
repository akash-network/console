"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePreviousRoute = void 0;
var jotai_1 = require("jotai");
var router_1 = require("next/router");
var usehooks_ts_1 = require("usehooks-ts");
var routeStore_1 = require("@src/store/routeStore");
var usePreviousRoute = function () {
    var router = (0, router_1.useRouter)();
    var _a = (0, jotai_1.useAtom)(routeStore_1.default.previousRoute), previousRoute = _a[0], setPreviousRoute = _a[1];
    (0, usehooks_ts_1.useEffectOnce)(function () {
        var _a;
        var handleRouteChange = function (url) {
            setPreviousRoute(url);
        };
        (_a = router.events) === null || _a === void 0 ? void 0 : _a.on("routeChangeStart", handleRouteChange);
        return function () {
            var _a;
            (_a = router.events) === null || _a === void 0 ? void 0 : _a.off("routeChangeStart", handleRouteChange);
        };
    });
    return previousRoute;
};
exports.usePreviousRoute = usePreviousRoute;
