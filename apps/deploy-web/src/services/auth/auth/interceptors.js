"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAnonymousUserToken = withAnonymousUserToken;
exports.withUserToken = withUserToken;
var auth_config_1 = require("@src/config/auth.config");
function withAnonymousUserToken(config) {
    var token = typeof localStorage !== "undefined" ? localStorage.getItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY) : null;
    if (token) {
        config.headers.set("authorization", "Bearer ".concat(token));
    }
    return config;
}
function withUserToken(config) {
    var token = typeof localStorage !== "undefined" ? localStorage.getItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY) : null;
    if (token) {
        config.headers.set("authorization", "Bearer ".concat(token));
    }
    else {
        config.baseURL = "/api/proxy";
    }
    return config;
}
