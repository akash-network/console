"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientIpForwardingInterceptor = clientIpForwardingInterceptor;
var requestExecutionContext_1 = require("@src/lib/nextjs/requestExecutionContext");
var headerNames = ["cf-connecting-ip", "x-forwarded-for"];
function clientIpForwardingInterceptor(config) {
    var context = requestExecutionContext_1.requestExecutionContext.getStore();
    if (!context) {
        console.error("No request headers found in async local storage. Looses original client IP address.", config.url, new Error().stack);
        return config;
    }
    headerNames.forEach(function (name) {
        var value = context.headers.get(name);
        if (value)
            config.headers.set(name, value);
    });
    return config;
}
