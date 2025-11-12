"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlagProvider = exports.UserAwareFlagProvider = void 0;
var react_1 = require("react");
var nextjs_1 = require("@unleash/nextjs");
var Layout_1 = require("@src/components/layout/Layout");
var browser_env_config_1 = require("@src/config/browser-env.config");
var useUser_1 = require("@src/hooks/useUser");
var COMPONENTS = {
    FlagProvider: nextjs_1.FlagProvider,
    useUser: useUser_1.useUser,
    WaitForFeatureFlags: WaitForFeatureFlags
};
var UserAwareFlagProvider = function (_a) {
    var children = _a.children, _b = _a.components, c = _b === void 0 ? COMPONENTS : _b;
    var user = c.useUser().user;
    var isEnableAll = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL;
    return (<c.FlagProvider config={{
            context: { userId: user === null || user === void 0 ? void 0 : user.id },
            fetch: isEnableAll ? function () { return new Response(JSON.stringify({ toggles: [] })); } : undefined
        }}>
      <c.WaitForFeatureFlags>{children}</c.WaitForFeatureFlags>
    </c.FlagProvider>);
};
exports.UserAwareFlagProvider = UserAwareFlagProvider;
exports.FlagProvider = exports.UserAwareFlagProvider;
function WaitForFeatureFlags(_a) {
    var children = _a.children;
    var client = (0, nextjs_1.useUnleashClient)();
    var _b = (0, react_1.useState)(false), isReady = _b[0], setIsReady = _b[1];
    (0, react_1.useEffect)(function () {
        if (client.isReady()) {
            setIsReady(true);
            return;
        }
        var callback;
        if (!client.isReady()) {
            callback = function () {
                if (timerId_1)
                    clearTimeout(timerId_1);
                setIsReady(true);
            };
            var timerId_1 = setTimeout(callback, 10000);
            client.once("ready", callback);
            client.once("error", callback);
        }
        return function () {
            if (callback) {
                client.off("ready", callback);
                client.off("error", callback);
            }
        };
    }, [client]);
    if (!isReady) {
        return <Layout_1.Loading text="Loading application..."/>;
    }
    return <>{children}</>;
}
