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
var faker_1 = require("@faker-js/faker");
var jest_mock_extended_1 = require("jest-mock-extended");
var pageGuards_1 = require("./pageGuards");
describe("pageGuards", function () {
    describe("isAuthenticated", function () {
        it("returns true when user is logged in", function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        context = setup({
                            session: {
                                user: {
                                    id: faker_1.faker.string.uuid()
                                }
                            }
                        });
                        return [4 /*yield*/, (0, pageGuards_1.isAuthenticated)(context)];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        it("returns false when user is not logged in", function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        context = setup({
                            session: undefined
                        });
                        return [4 /*yield*/, (0, pageGuards_1.isAuthenticated)(context)];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("isFeatureEnabled", function () {
        it("returns true when feature flag is enabled", function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        context = setup({
                            enabledFeatures: ["test"]
                        });
                        _a = expect;
                        return [4 /*yield*/, (0, pageGuards_1.isFeatureEnabled)("test", context)];
                    case 1:
                        _a.apply(void 0, [_c.sent()]).toBe(true);
                        _b = expect;
                        return [4 /*yield*/, (0, pageGuards_1.isFeatureEnabled)("test2", context)];
                    case 2:
                        _b.apply(void 0, [_c.sent()]).toBe(false);
                        expect(context.services.featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("test", context, expect.anything());
                        return [2 /*return*/];
                }
            });
        }); });
        it("passes the user id to the feature flag service", function () { return __awaiter(void 0, void 0, void 0, function () {
            var userId, context, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        userId = faker_1.faker.string.uuid();
                        context = setup({
                            enabledFeatures: ["test"],
                            session: {
                                user: {
                                    id: userId
                                }
                            }
                        });
                        _a = expect;
                        return [4 /*yield*/, (0, pageGuards_1.isFeatureEnabled)("test", context)];
                    case 1:
                        _a.apply(void 0, [_b.sent()]).toBe(true);
                        expect(context.services.featureFlagService.isEnabledForCtx).toHaveBeenCalledWith("test", context, { userId: userId });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("redirectIfAccessTokenExpired", function () {
        it("returns null when access token is not expired", function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        context = setup({
                            session: {
                                accessTokenExpiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
                            }
                        });
                        return [4 /*yield*/, (0, pageGuards_1.redirectIfAccessTokenExpired)(context)];
                    case 1:
                        result = _a.sent();
                        expect(result).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        it("returns redirect when access token is expired", function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        context = setup({
                            session: {
                                accessTokenExpiresAt: (Date.now() - 1000 * 60 * 60 * 24 * 30) / 1000
                            }
                        });
                        return [4 /*yield*/, (0, pageGuards_1.redirectIfAccessTokenExpired)(context)];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual({
                            redirect: {
                                destination: expect.stringMatching(/^\/api\/auth\/login/),
                                permanent: false
                            }
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function setup(input) {
    var _this = this;
    return (0, jest_mock_extended_1.mock)({
        session: input === null || input === void 0 ? void 0 : input.session,
        services: {
            featureFlagService: (0, jest_mock_extended_1.mock)({
                isEnabledForCtx: jest.fn(function (featureName) { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                    return [2 /*return*/, !!((_a = input === null || input === void 0 ? void 0 : input.enabledFeatures) === null || _a === void 0 ? void 0 : _a.includes(featureName))];
                }); }); })
            }),
            logger: (0, jest_mock_extended_1.mock)()
        }
    });
}
