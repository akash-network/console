"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFallbackableHttpClient = createFallbackableHttpClient;
var cockatiel_1 = require("cockatiel");
var createFetchAdapter_1 = require("../createFetchAdapter/createFetchAdapter");
function createFallbackableHttpClient(createHttpClient, fallbackHttpClient, options) {
    var httpClient = createHttpClient({
        baseURL: options.baseURL,
        adapter: (0, createFetchAdapter_1.createFetchAdapter)({
            circuitBreaker: {
                halfOpenAfter: new cockatiel_1.ExponentialBackoff({
                    maxDelay: 5 * 60 * 1000
                }),
                breaker: {
                    state: null,
                    success: function () { },
                    failure: options.shouldFallback
                }
            },
            onFailure: function (error, requestConfig) {
                var _a;
                if ((0, createFetchAdapter_1.isNetworkOrIdempotentRequestError)(error) || (0, cockatiel_1.isBrokenCircuitError)(error)) {
                    return Promise.resolve((_a = options.onUnavailableError) === null || _a === void 0 ? void 0 : _a.call(options, error)).then(function () {
                        var adapter = requestConfig.adapter, restOfRequestConfig = __rest(requestConfig, ["adapter"]);
                        return fallbackHttpClient.request(restOfRequestConfig);
                    });
                }
            },
            onSuccess: options.onSuccess
        }),
        "axios-retry": {
            retries: 0
        }
    });
    Object.defineProperty(httpClient, "isFallbackEnabled", {
        get: options.shouldFallback
    });
    return httpClient;
}
