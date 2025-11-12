"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerProxyUrlWs = void 0;
var browser_env_config_1 = require("@src/config/browser-env.config");
exports.providerProxyUrlWs = constructUrl(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL);
function constructUrl(input) {
    if (typeof window === "undefined" || !input.startsWith("/")) {
        return input;
    }
    var url = new URL(input, window.location.origin);
    url.protocol = url.protocol.replace("http", "ws");
    return url.toString();
}
