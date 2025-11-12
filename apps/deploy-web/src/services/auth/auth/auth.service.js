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
exports.AuthService = void 0;
exports.withAnonymousUserToken = withAnonymousUserToken;
exports.withUserToken = withUserToken;
var auth_config_1 = require("@src/config/auth.config");
var keys_1 = require("../../storage/keys");
var AuthService = /** @class */ (function () {
    function AuthService(urlService, internalApiHttpClient, location, localStorage) {
        if (location === void 0) { location = window.location; }
        if (localStorage === void 0) { localStorage = window.localStorage; }
        this.urlService = urlService;
        this.internalApiHttpClient = internalApiHttpClient;
        this.location = location;
        this.localStorage = localStorage;
    }
    AuthService.prototype.signup = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var params, queryParams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = new URLSearchParams();
                        if (options === null || options === void 0 ? void 0 : options.returnTo)
                            params.append("returnTo", options.returnTo);
                        // send http request to store anonymous user token in a cookie
                        // this is is needed only when anonymous free trial is enabled
                        return [4 /*yield*/, this.internalApiHttpClient.get(this.urlService.signup(), {
                                fetchOptions: {
                                    redirect: "manual"
                                }
                            })];
                    case 1:
                        // send http request to store anonymous user token in a cookie
                        // this is is needed only when anonymous free trial is enabled
                        _a.sent();
                        queryParams = params.toString();
                        // redirect user to the same url because it's impossible to read Location header in browser
                        this.location.assign(this.urlService.signup() + (queryParams ? "?".concat(queryParams) : ""));
                        return [2 /*return*/];
                }
            });
        });
    };
    AuthService.prototype.logout = function () {
        this.localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
        this.localStorage.removeItem(keys_1.ONBOARDING_STEP_KEY);
        this.location.assign(this.urlService.logout());
    };
    return AuthService;
}());
exports.AuthService = AuthService;
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
