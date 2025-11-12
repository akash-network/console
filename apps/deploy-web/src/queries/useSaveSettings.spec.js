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
var client_1 = require("@auth0/nextjs-auth0/client");
var jest_mock_extended_1 = require("jest-mock-extended");
var CustomSnackbarProvider_1 = require("../../../../packages/ui/context/CustomSnackbarProvider");
var query_client_1 = require("../../tests/unit/query-client");
var useSaveSettings_1 = require("./useSaveSettings");
var react_1 = require("@testing-library/react");
describe("Settings management", function () {
    describe(useSaveSettings_1.useSaveSettings.name, function () {
        it("saves settings successfully, call checkSession and show success snackbar", function () { return __awaiter(void 0, void 0, void 0, function () {
            var newSettings, consoleApiHttpClient, fetchUser, result, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        newSettings = {
                            username: "testuser",
                            subscribedToNewsletter: true
                        };
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        fetchUser = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ email: "test@akash.network" })];
                        }); }); });
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            },
                            fetchUser: fetchUser
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(newSettings); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, !result.current.isPending];
                            }); }); })];
                    case 1:
                        _b.sent();
                        expect(consoleApiHttpClient.put).toHaveBeenCalledWith(expect.stringContaining("user/updateSettings"), newSettings);
                        expect(fetchUser).toHaveBeenCalledTimes(2);
                        expect(result.current.isSuccess).toBe(true);
                        _a = expect;
                        return [4 /*yield*/, react_1.screen.findByText(/Settings saved/i)];
                    case 2:
                        _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when saving settings and show error snackbar", function () { return __awaiter(void 0, void 0, void 0, function () {
            var newSettings, consoleApiHttpClient, fetchUser, result, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        newSettings = {
                            username: "testuser",
                            subscribedToNewsletter: true
                        };
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.put.mockRejectedValue(new Error("Network error"));
                        fetchUser = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ email: "test@akash.network" })];
                        }); }); });
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            },
                            fetchUser: fetchUser
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(newSettings); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, !result.current.isPending];
                            }); }); })];
                    case 1:
                        _b.sent();
                        expect(fetchUser).toHaveBeenCalledTimes(1);
                        _a = expect;
                        return [4 /*yield*/, react_1.screen.findByText(/Error saving settings/i)];
                    case 2:
                        _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            var user = { email: "test@akash.network" };
            return (0, query_client_1.setupQuery)(function () { return (0, useSaveSettings_1.useSaveSettings)(); }, {
                services: input === null || input === void 0 ? void 0 : input.services,
                wrapper: function (_a) {
                    var _b;
                    var children = _a.children;
                    return (<CustomSnackbarProvider_1.CustomSnackbarProvider>
            <client_1.UserProvider fetcher={(_b = input === null || input === void 0 ? void 0 : input.fetchUser) !== null && _b !== void 0 ? _b : (function () { return Promise.resolve(user); })}>{children}</client_1.UserProvider>
          </CustomSnackbarProvider_1.CustomSnackbarProvider>);
                }
            });
        }
    });
    describe(useSaveSettings_1.useDepositParams.name, function () {
        it("should fetch deposit params successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var chainApiHttpClient, depositParams, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            isFallbackEnabled: false
                        });
                        depositParams = {
                            denom: "uakt",
                            minDeposit: "1000000"
                        };
                        chainApiHttpClient.get.mockResolvedValue({
                            data: {
                                param: {
                                    value: JSON.stringify(depositParams)
                                }
                            }
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useSaveSettings_1.useDepositParams)(); }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("cosmos/params/v1beta1/params"));
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(depositParams);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when fetching deposit params", function () { return __awaiter(void 0, void 0, void 0, function () {
            var chainApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            isFallbackEnabled: false
                        });
                        chainApiHttpClient.get.mockRejectedValue(new Error("Failed to fetch deposit params"));
                        result = (0, query_client_1.setupQuery)(function () { return (0, useSaveSettings_1.useDepositParams)(); }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("cosmos/params/v1beta1/params"));
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
