"use strict";
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
exports.ANONYMOUS_HEADER_COOKIE_NAME = void 0;
var nextjs_auth0_1 = require("@auth0/nextjs-auth0");
var defineApiHandler_1 = require("@src/lib/nextjs/defineApiHandler/defineApiHandler");
var rewrite_local_redirect_1 = require("@src/services/auth/auth/rewrite-local-redirect");
exports.ANONYMOUS_HEADER_COOKIE_NAME = "anonymous-auth";
exports.default = (0, defineApiHandler_1.defineApiHandler)({
    route: "/api/auth/signup",
    handler: function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var returnUrl, token, lifetime, isSecure, error_1, severity;
            var _c;
            var res = _b.res, req = _b.req, services = _b.services;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        if (services.config.AUTH0_LOCAL_ENABLED && services.config.AUTH0_REDIRECT_BASE_URL) {
                            (0, rewrite_local_redirect_1.rewriteLocalRedirect)(res, services.config);
                        }
                        returnUrl = decodeURIComponent((_c = req.query.returnTo) !== null && _c !== void 0 ? _c : "/");
                        token = req.headers.authorization;
                        // If token is available, it means that the request is made with fetch API call
                        // then we set cookie and return 204 status, the actual call will be made by in-browser redirect
                        if (token) {
                            lifetime = 5 * 60;
                            isSecure = services.config.NODE_ENV === "production";
                            res.setHeader("Set-Cookie", "".concat(exports.ANONYMOUS_HEADER_COOKIE_NAME, "=").concat(encodeURIComponent(token.replace(/^Bearer\s+/i, "")), "; HttpOnly; ").concat(isSecure ? "Secure;" : "", " SameSite=Lax; Path=/api/auth/callback; Max-Age=").concat(lifetime));
                            res.status(204).end();
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, (0, nextjs_auth0_1.handleLogin)(req, res, {
                                returnTo: returnUrl,
                                authorizationParams: {
                                    // Note that this can be combined with prompt=login , which indicates if
                                    // you want to always show the authentication page or you want to skip
                                    // if there's an existing session.
                                    //screen_hint: "signup" // <== New Universal Signup
                                    action: "signup" // <== Classic Universal Login
                                }
                            })];
                    case 1:
                        _d.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _d.sent();
                        severity = "error";
                        if ((error_1 === null || error_1 === void 0 ? void 0 : error_1.status) && error_1.status >= 400 && error_1.status < 500) {
                            severity = "warning";
                            res.status(400).send({ message: error_1.message });
                        }
                        else {
                            res.status(503).send({ message: "An unexpected error occurred. Please try again later." });
                        }
                        services.errorHandler.reportError({ severity: severity, error: error_1, tags: { category: "auth0", event: "AUTH_SIGNUP_ERROR" } });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
});
