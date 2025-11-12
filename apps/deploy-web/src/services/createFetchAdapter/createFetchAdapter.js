"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFetchAdapter = createFetchAdapter;
exports.isNetworkOrIdempotentRequestError = isNetworkOrIdempotentRequestError;
var axios_1 = require("axios");
var cockatiel_1 = require("cockatiel");
var EXTRA_RETRY_AFTER_DELAY = 10 * 1000;
function createFetchAdapter(options) {
    var _a, _b, _c;
    if (options === void 0) { options = {}; }
    var handleNetworkOrIdempotentError = (0, cockatiel_1.handleWhen)(function (error) { return isNetworkOrIdempotentRequestError(error); });
    var retryPolicy = (0, cockatiel_1.retry)(handleNetworkOrIdempotentError, {
        maxAttempts: options.retries || 3,
        backoff: new cockatiel_1.DelegateBackoff(function (context) {
            var _a;
            if (!("error" in context.result) || !axios_1.default.isAxiosError(context.result.error))
                return 0;
            var retryAfterHeader = (_a = context.result.error.response) === null || _a === void 0 ? void 0 : _a.headers["retry-after"];
            if (!retryAfterHeader)
                return 50;
            var retryAfterNumber = parseInt(retryAfterHeader, 10);
            if (!Number.isNaN(retryAfterNumber))
                return retryAfterNumber * 1000 + EXTRA_RETRY_AFTER_DELAY;
            var retryAfterDate = new Date(retryAfterHeader);
            if (!Number.isNaN(retryAfterDate.getTime())) {
                return retryAfterDate.getTime() - Date.now() + EXTRA_RETRY_AFTER_DELAY;
            }
            return 0;
        })
    });
    var circuitBreakerPolicy = (0, cockatiel_1.circuitBreaker)(cockatiel_1.handleAll, {
        breaker: ((_a = options.circuitBreaker) === null || _a === void 0 ? void 0 : _a.breaker) || new cockatiel_1.ConsecutiveBreaker(((_b = options.circuitBreaker) === null || _b === void 0 ? void 0 : _b.maxAttempts) || 1),
        halfOpenAfter: ((_c = options.circuitBreaker) === null || _c === void 0 ? void 0 : _c.halfOpenAfter) || 15 * 1000
    });
    // X times retry inside circuit breaker, if it fails, open the circuit breaker
    var retryWithBreaker = (0, cockatiel_1.wrap)(circuitBreakerPolicy, retryPolicy);
    if (options.onSuccess) {
        retryWithBreaker.onSuccess(options.onSuccess);
    }
    var fetchAdapter = options.adapter || axios_1.default.getAdapter("fetch");
    return function (config) {
        return retryWithBreaker
            .execute(function () { return fetchAdapter(config); }, config.signal)
            .catch(function (error) {
            var _a;
            var result = (_a = options.onFailure) === null || _a === void 0 ? void 0 : _a.call(options, error, config);
            return result ? result : Promise.reject(error);
        });
    };
}
function isNetworkOrIdempotentRequestError(error) {
    var isNetworkError = error && !axios_1.default.isAxiosError(error) && error instanceof Error && "code" in error && error.code;
    if (isNetworkError)
        return isRetriableError(error);
    return axios_1.default.isAxiosError(error) && isIdempotentRequestError(error);
}
function isRetriableError(error) {
    var code = error.code;
    return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT";
}
var IDEMPOTENT_HTTP_METHODS = ["get", "head", "options", "delete", "put"];
function isIdempotentRequestError(error) {
    var _a;
    if (!((_a = error.config) === null || _a === void 0 ? void 0 : _a.method))
        return false;
    return (IDEMPOTENT_HTTP_METHODS.includes(error.config.method.toLowerCase()) &&
        error.code !== "ECONNABORTED" &&
        (!error.response || error.response.status === 429 || (error.response.status >= 500 && error.response.status < 600)));
}
