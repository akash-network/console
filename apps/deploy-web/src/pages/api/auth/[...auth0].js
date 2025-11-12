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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var nextjs_auth0_1 = require("@auth0/nextjs-auth0");
var nextjs_auth0_2 = require("@auth0/nextjs-auth0");
var axios_1 = require("axios");
var lodash_1 = require("lodash");
var defineApiHandler_1 = require("@src/lib/nextjs/defineApiHandler/defineApiHandler");
var rewrite_local_redirect_1 = require("@src/services/auth/auth/rewrite-local-redirect");
var signup_1 = require("./signup");
exports.default = (0, defineApiHandler_1.defineApiHandler)({
    route: "/api/auth/[...auth0]",
    handler: function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var res = _b.res, req = _b.req, services = _b.services;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, authHandler(services)(req, res)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
});
var authHandler = (0, lodash_1.once)(function (services) {
    return (0, nextjs_auth0_2.handleAuth)({
        login: function (req, res) {
            return __awaiter(this, void 0, void 0, function () {
                var returnUrl;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            returnUrl = decodeURIComponent((_a = req.query.from) !== null && _a !== void 0 ? _a : "/");
                            if (services.config.AUTH0_LOCAL_ENABLED && services.config.AUTH0_REDIRECT_BASE_URL) {
                                (0, rewrite_local_redirect_1.rewriteLocalRedirect)(res, services.config);
                            }
                            return [4 /*yield*/, (0, nextjs_auth0_2.handleLogin)(req, res, {
                                    returnTo: returnUrl,
                                    // Reduce the scope to minimize session data
                                    authorizationParams: {
                                        scope: "openid profile email offline_access"
                                    }
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        callback: function (req, res) {
            return __awaiter(this, void 0, void 0, function () {
                var error_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, (0, nextjs_auth0_2.handleCallback)(req, res, {
                                    afterCallback: function (req, res, session) { return __awaiter(_this, void 0, void 0, function () {
                                        var user_metadata, headers, anonymousAuthorization, userSettings, isSecure, error_2;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    _a.trys.push([0, 2, , 3]);
                                                    user_metadata = session.user["https://console.akash.network/user_metadata"];
                                                    headers = new axios_1.AxiosHeaders({
                                                        Authorization: "Bearer ".concat(session.accessToken)
                                                    });
                                                    anonymousAuthorization = req.cookies[signup_1.ANONYMOUS_HEADER_COOKIE_NAME];
                                                    if (anonymousAuthorization) {
                                                        headers.set("x-anonymous-authorization", decodeURIComponent(anonymousAuthorization));
                                                    }
                                                    return [4 /*yield*/, services.consoleApiHttpClient.post("".concat(services.apiUrlService.getBaseApiUrlFor(services.config.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID), "/v1/register-user"), {
                                                            wantedUsername: session.user.nickname,
                                                            email: session.user.email,
                                                            emailVerified: session.user.email_verified,
                                                            subscribedToNewsletter: (user_metadata === null || user_metadata === void 0 ? void 0 : user_metadata.subscribedToNewsletter) === "true"
                                                        }, {
                                                            headers: headers.toJSON()
                                                        })];
                                                case 1:
                                                    userSettings = _a.sent();
                                                    session.user = __assign(__assign({}, session.user), userSettings.data.data);
                                                    isSecure = services.config.NODE_ENV === "production";
                                                    res.setHeader("Set-Cookie", "".concat(signup_1.ANONYMOUS_HEADER_COOKIE_NAME, "=; Path=/api/auth/callback; HttpOnly; ").concat(isSecure ? "Secure;" : "", " SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"));
                                                    return [3 /*break*/, 3];
                                                case 2:
                                                    error_2 = _a.sent();
                                                    services.errorHandler.reportError({ error: error_2, tags: { category: "auth0" } });
                                                    return [3 /*break*/, 3];
                                                case 3: return [2 /*return*/, session];
                                            }
                                        });
                                    }); }
                                })];
                        case 1:
                            _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            error_1 = _a.sent();
                            services.errorHandler.reportError({ error: error_1, tags: { category: "auth0", event: "AUTH_CALLBACK_ERROR" } });
                            throw error_1;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        },
        logout: services.config.AUTH0_LOCAL_ENABLED
            ? function (req, res) {
                return __awaiter(this, void 0, void 0, function () {
                    var cookies, expiredCookies;
                    return __generator(this, function (_a) {
                        cookies = req.cookies;
                        expiredCookies = Object.keys(cookies)
                            .filter(function (key) { return key.startsWith("appSession"); })
                            .map(function (key) { return "".concat(key, "=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"); });
                        res.setHeader("Set-Cookie", expiredCookies);
                        res.writeHead(302, { Location: "/" });
                        res.end();
                        return [2 /*return*/];
                    });
                });
            }
            : nextjs_auth0_2.handleLogout,
        profile: function (req, res) {
            return __awaiter(this, void 0, void 0, function () {
                var error_3, severity;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            services.logger.info({ event: "AUTH_PROFILE_REQUEST", url: req.url });
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, (0, nextjs_auth0_2.handleProfile)(req, res, {
                                    refetch: true,
                                    afterRefetch: function (req, res, session) { return __awaiter(_this, void 0, void 0, function () {
                                        var headers, userSettings, error_4;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    _a.trys.push([0, 2, , 3]);
                                                    headers = new axios_1.AxiosHeaders({
                                                        Authorization: "Bearer ".concat(session.accessToken)
                                                    });
                                                    return [4 /*yield*/, services.consoleApiHttpClient.get("".concat(services.apiUrlService.getBaseApiUrlFor(services.config.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID), "/v1/user/me"), {
                                                            headers: headers.toJSON()
                                                        })];
                                                case 1:
                                                    userSettings = _a.sent();
                                                    session.user = __assign(__assign({}, session.user), userSettings.data.data);
                                                    return [3 /*break*/, 3];
                                                case 2:
                                                    error_4 = _a.sent();
                                                    services.errorHandler.reportError({ error: error_4, tags: { category: "auth0" } });
                                                    return [3 /*break*/, 3];
                                                case 3: return [2 /*return*/, session];
                                            }
                                        });
                                    }); }
                                })];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_3 = _a.sent();
                            if (isAccessTokenExpiredError(error_3)) {
                                services.logger.warn({ event: "AUTH_ACCESS_TOKEN_EXPIRED", url: req.url });
                                redirectToLogin(req, res);
                                return [2 /*return*/];
                            }
                            severity = "error";
                            if (isGeneralAxiosError(error_3)) {
                                severity = "warning";
                                res.status(400).send({ message: error_3.message });
                            }
                            else {
                                res.status(503).send({ message: "An unexpected error occurred. Please try again later." });
                            }
                            services.errorHandler.reportError({ severity: severity, error: error_3, tags: { category: "auth0", event: "AUTH_PROFILE_ERROR" } });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }
    });
});
function isAccessTokenExpiredError(error) {
    return error instanceof nextjs_auth0_1.ProfileHandlerError && error.cause instanceof nextjs_auth0_1.AccessTokenError && error.cause.code === nextjs_auth0_1.AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN;
}
function isGeneralAxiosError(error) {
    return (0, axios_1.isAxiosError)(error) && !!(error === null || error === void 0 ? void 0 : error.status) && error.status >= 400 && error.status < 500;
}
function redirectToLogin(req, res) {
    var returnUrl = encodeURIComponent(req.url || "/");
    var loginUrl = "/api/auth/login?from=".concat(returnUrl);
    res.writeHead(302, { Location: loginUrl });
    res.end();
}
