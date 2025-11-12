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
var query_client_1 = require("../../tests/unit/query-client");
var useVerifyEmailQuery_1 = require("./useVerifyEmailQuery");
var react_1 = require("@testing-library/react");
describe(useVerifyEmailQuery_1.useVerifyEmail.name, function () {
    var mockAuthService = (0, jest_mock_extended_1.mock)();
    var defaultServices = {
        auth: function () { return mockAuthService; }
    };
    beforeEach(function () {
        jest.clearAllMocks();
    });
    it("calls auth.verifyEmail with the provided email", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: {
                            emailVerified: true
                        }
                    };
                    mockAuthService.verifyEmail.mockResolvedValue(mockResponse);
                    result = (0, query_client_1.setupQuery)(function () { return (0, useVerifyEmailQuery_1.useVerifyEmail)(); }, {
                        services: defaultServices
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.mutate("test@example.com");
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(mockAuthService.verifyEmail).toHaveBeenCalledWith("test@example.com");
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onSuccess callback with emailVerified status when verification succeeds", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, onSuccessCallback, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: {
                            emailVerified: true
                        }
                    };
                    mockAuthService.verifyEmail.mockResolvedValue(mockResponse);
                    onSuccessCallback = jest.fn();
                    result = (0, query_client_1.setupQuery)(function () { return (0, useVerifyEmailQuery_1.useVerifyEmail)({ onSuccess: onSuccessCallback }); }, {
                        services: defaultServices
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.mutate("test@example.com");
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(onSuccessCallback).toHaveBeenCalledWith(true);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onSuccess callback with false when email is not verified", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, onSuccessCallback, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: {
                            emailVerified: false
                        }
                    };
                    mockAuthService.verifyEmail.mockResolvedValue(mockResponse);
                    onSuccessCallback = jest.fn();
                    result = (0, query_client_1.setupQuery)(function () { return (0, useVerifyEmailQuery_1.useVerifyEmail)({ onSuccess: onSuccessCallback }); }, {
                        services: defaultServices
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.mutate("test@example.com");
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(onSuccessCallback).toHaveBeenCalledWith(false);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onError callback when verification fails", function () { return __awaiter(void 0, void 0, void 0, function () {
        var error, onErrorCallback, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    error = new Error("Verification failed");
                    mockAuthService.verifyEmail.mockRejectedValue(error);
                    onErrorCallback = jest.fn();
                    result = (0, query_client_1.setupQuery)(function () { return (0, useVerifyEmailQuery_1.useVerifyEmail)({ onError: onErrorCallback }); }, {
                        services: defaultServices
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.mutate("test@example.com");
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(onErrorCallback).toHaveBeenCalled();
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
