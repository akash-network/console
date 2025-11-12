"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.ErrorHandlerService = void 0;
var http_sdk_1 = require("@akashnetwork/http-sdk");
var nextjs_1 = require("@sentry/nextjs");
var ErrorHandlerService = /** @class */ (function () {
    function ErrorHandlerService(logger, captureException) {
        if (captureException === void 0) { captureException = nextjs_1.captureException; }
        this.logger = logger;
        this.captureException = captureException;
    }
    ErrorHandlerService.prototype.getTraceData = function () {
        var data = (0, nextjs_1.getTraceData)();
        return {
            traceId: data["sentry-trace"],
            baggage: data.baggage
        };
    };
    ErrorHandlerService.prototype.reportError = function (_a) {
        var _b;
        var severity = _a.severity, error = _a.error, tags = _a.tags, extra = __rest(_a, ["severity", "error", "tags"]);
        var finalTags = __assign({}, tags);
        if ((0, http_sdk_1.isHttpError)(error) && error.response && error.response.status !== 400) {
            finalTags.status = error.response.status.toString();
            finalTags.method = ((_b = error.response.config.method) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || "UNKNOWN";
            finalTags.url = error.response.config.url || "UNKNOWN";
            extra.headers = error.response.headers;
        }
        this.logger.error(__assign(__assign(__assign({}, extra), finalTags), { error: error }));
        this.captureException(error, {
            level: severity,
            extra: extra,
            tags: finalTags
        });
    };
    ErrorHandlerService.prototype.wrapCallback = function (fn, options) {
        var _this = this;
        return (function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            try {
                var result = fn.apply(void 0, args);
                if (result && typeof result.catch === "function") {
                    return result.catch(function (error) {
                        _this.reportError({ error: error, tags: options === null || options === void 0 ? void 0 : options.tags });
                        if (options === null || options === void 0 ? void 0 : options.fallbackValue)
                            return options.fallbackValue();
                    });
                }
                return result;
            }
            catch (error) {
                _this.reportError({ error: error, tags: options === null || options === void 0 ? void 0 : options.tags });
                if (options === null || options === void 0 ? void 0 : options.fallbackValue)
                    return options.fallbackValue();
            }
        });
    };
    return ErrorHandlerService;
}());
exports.ErrorHandlerService = ErrorHandlerService;
