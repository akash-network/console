"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var network_store_1 = require("@akashnetwork/network-store");
var browser_env_config_1 = require("@src/config/browser-env.config");
var global_store_1 = require("@src/store/global-store");
exports.default = network_store_1.NetworkStore.create({
    defaultNetworkId: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID,
    apiBaseUrl: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_API_BASE_URL,
    store: global_store_1.store
});
