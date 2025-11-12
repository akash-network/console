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
var jest_mock_extended_1 = require("jest-mock-extended");
var auth_config_1 = require("@src/config/auth.config");
var keys_1 = require("@src/services/storage/keys");
var auth_service_1 = require("./auth.service");
describe(auth_service_1.AuthService.name, function () {
    var mockSignupUrl = "https://auth.example.com/signup";
    var mockLogoutUrl = "https://auth.example.com/logout";
    describe("signup", function () {
        it("calls signup URL without returnTo parameter", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, httpClient, location;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, httpClient = _a.httpClient, location = _a.location;
                        return [4 /*yield*/, service.signup()];
                    case 1:
                        _b.sent();
                        expect(httpClient.get).toHaveBeenCalledWith(mockSignupUrl, expect.any(Object));
                        expect(location.assign).toHaveBeenCalledWith(mockSignupUrl);
                        return [2 /*return*/];
                }
            });
        }); });
        it("calls signup URL with returnTo parameter", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, httpClient, location, returnTo;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, httpClient = _a.httpClient, location = _a.location;
                        returnTo = "/dashboard";
                        return [4 /*yield*/, service.signup({ returnTo: returnTo })];
                    case 1:
                        _b.sent();
                        expect(httpClient.get).toHaveBeenCalledWith(mockSignupUrl, expect.any(Object));
                        expect(location.assign).toHaveBeenCalledWith("".concat(mockSignupUrl, "?returnTo=").concat(encodeURIComponent(returnTo)));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("logout", function () {
        it("clears localStorage items and redirects to logout URL", function () {
            var _a = setup(), service = _a.service, location = _a.location, localStorage = _a.localStorage;
            // Set up localStorage items
            localStorage.setItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY, "test-token");
            localStorage.setItem(keys_1.ONBOARDING_STEP_KEY, "2");
            service.logout();
            expect(localStorage.getItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY)).toBeNull();
            expect(localStorage.getItem(keys_1.ONBOARDING_STEP_KEY)).toBeNull();
            expect(location.assign).toHaveBeenCalledWith(mockLogoutUrl);
        });
    });
    describe("withAnonymousUserToken", function () {
        it("adds authorization header when token exists in localStorage", function () {
            var token = "test-anonymous-token";
            localStorage.setItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY, token);
            var config = (0, jest_mock_extended_1.mockDeep)();
            (0, auth_service_1.withAnonymousUserToken)(config);
            expect(config.headers.set).toHaveBeenCalledWith("authorization", "Bearer ".concat(token));
            localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
            config = (0, jest_mock_extended_1.mockDeep)();
            (0, auth_service_1.withAnonymousUserToken)(config);
            expect(config.headers.set).not.toHaveBeenCalled();
        });
    });
    describe("withUserToken", function () {
        it("adds authorization header when token exists in localStorage", function () {
            var token = "test-user-token";
            localStorage.setItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY, token);
            var config = (0, jest_mock_extended_1.mockDeep)();
            (0, auth_service_1.withUserToken)(config);
            expect(config.headers.set).toHaveBeenCalledWith("authorization", "Bearer ".concat(token));
        });
        it("should set baseURL to proxy when token does not exist", function () {
            localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
            var config = {
                baseURL: "/",
                headers: (0, jest_mock_extended_1.mock)()
            };
            (0, auth_service_1.withUserToken)(config);
            expect(config.baseURL).toBe("/api/proxy");
            expect(config.headers.set).not.toHaveBeenCalled();
        });
    });
    function setup() {
        var httpClient = (0, jest_mock_extended_1.mock)({
            get: jest.fn().mockResolvedValue({ data: {} })
        });
        var urlService = (0, jest_mock_extended_1.mock)({
            signup: jest.fn().mockReturnValue(mockSignupUrl),
            logout: jest.fn().mockReturnValue(mockLogoutUrl)
        });
        var location = (0, jest_mock_extended_1.mock)();
        var service = new auth_service_1.AuthService(urlService, httpClient, location);
        return {
            service: service,
            httpClient: httpClient,
            urlService: urlService,
            location: location,
            localStorage: localStorage
        };
    }
});
