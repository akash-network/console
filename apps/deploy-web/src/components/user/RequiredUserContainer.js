"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiredUserContainer = void 0;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var LoadingBlocker_1 = require("@src/components/layout/LoadingBlocker/LoadingBlocker");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var RequiredUserContainer = function (_a) {
    var children = _a.children;
    var _b = (0, useCustomUser_1.useCustomUser)(), user = _b.user, isLoading = _b.isLoading;
    var router = (0, navigation_1.useRouter)();
    (0, react_1.useEffect)(function () {
        if (!user && !isLoading) {
            router.push("/404");
        }
    }, [user, isLoading, router]);
    return <LoadingBlocker_1.LoadingBlocker isLoading={isLoading}>{typeof children === "function" ? children(user) : children}</LoadingBlocker_1.LoadingBlocker>;
};
exports.RequiredUserContainer = RequiredUserContainer;
