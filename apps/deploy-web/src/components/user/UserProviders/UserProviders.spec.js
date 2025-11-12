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
var UserProviders_1 = require("./UserProviders");
var react_1 = require("@testing-library/react");
var user_1 = require("@tests/seeders/user");
var TestContainerProvider_1 = require("@tests/unit/TestContainerProvider");
describe(UserProviders_1.UserProviders.name, function () {
    it("shows loader when user is loading", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({
                        getProfile: function () { return new Promise(function () { }); }
                    })];
                case 1:
                    _a.sent();
                    expect(react_1.screen.getByRole("status")).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it("tracks user changes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, anonymousUser, userTracker, analyticsService, rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = (0, user_1.buildUser)();
                    anonymousUser = (0, user_1.buildAnonymousUser)();
                    userTracker = (0, jest_mock_extended_1.mock)();
                    analyticsService = (0, jest_mock_extended_1.mock)();
                    return [4 /*yield*/, setup({
                            getProfile: jest
                                .fn()
                                .mockImplementationOnce(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, user];
                            }); }); })
                                .mockImplementationOnce(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, undefined];
                            }); }); }),
                            getOrCreateAnonymousUser: jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, ({ data: anonymousUser })];
                            }); }); }),
                            userTracker: userTracker,
                            analyticsService: analyticsService
                        })];
                case 1:
                    rerender = (_a.sent()).rerender;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(react_1.screen.queryByRole("status")).not.toBeInTheDocument();
                        })];
                case 2:
                    _a.sent();
                    expect(userTracker.track).toHaveBeenCalledWith(user);
                    expect(analyticsService.identify).toHaveBeenCalledWith({
                        id: user.id,
                        anonymous: !user.userId,
                        emailVerified: user.emailVerified
                    });
                    (0, react_1.act)(function () { return rerender(); });
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(react_1.screen.queryByRole("status")).not.toBeInTheDocument();
                        })];
                case 3:
                    _a.sent();
                    expect(userTracker.track).toHaveBeenCalledWith(undefined);
                    expect(userTracker.track).toHaveBeenCalledWith(anonymousUser);
                    expect(analyticsService.identify).toHaveBeenCalledTimes(2);
                    expect(analyticsService.identify).toHaveBeenCalledWith({
                        id: anonymousUser.id,
                        anonymous: !anonymousUser.userId,
                        emailVerified: anonymousUser.emailVerified
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        return __awaiter(this, void 0, void 0, function () {
            var services, id, genContent, result;
            var _this = this;
            return __generator(this, function (_a) {
                services = {
                    internalApiHttpClient: function () {
                        return (0, jest_mock_extended_1.mock)({
                            get: (function () {
                                if (input === null || input === void 0 ? void 0 : input.getProfile)
                                    return input.getProfile().then(function (data) { return ({ data: data }); });
                                return Promise.resolve({
                                    data: (0, user_1.buildUser)()
                                });
                            })
                        });
                    },
                    userTracker: function () { return (input === null || input === void 0 ? void 0 : input.userTracker) || (0, jest_mock_extended_1.mock)(); },
                    analyticsService: function () { return (input === null || input === void 0 ? void 0 : input.analyticsService) || (0, jest_mock_extended_1.mock)(); },
                    appConfig: function () {
                        return (0, jest_mock_extended_1.mock)({
                            NEXT_PUBLIC_BILLING_ENABLED: true
                        });
                    },
                    user: function () {
                        return (0, jest_mock_extended_1.mock)({
                            getOrCreateAnonymousUser: (input === null || input === void 0 ? void 0 : input.getOrCreateAnonymousUser) || (function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, ({ data: (0, user_1.buildAnonymousUser)() })];
                            }); }); })
                        });
                    }
                };
                id = 0;
                genContent = function () { return (<TestContainerProvider_1.TestContainerProvider services={services}>
        <UserProviders_1.UserProviders key={++id}>content</UserProviders_1.UserProviders>
      </TestContainerProvider_1.TestContainerProvider>); };
                result = (0, react_1.render)(genContent());
                return [2 /*return*/, {
                        result: result,
                        rerender: function () { return result.rerender(genContent()); }
                    }];
            });
        });
    }
});
