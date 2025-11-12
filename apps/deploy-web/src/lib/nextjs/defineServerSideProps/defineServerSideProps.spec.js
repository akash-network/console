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
var axios_1 = require("axios");
var jest_mock_extended_1 = require("jest-mock-extended");
var zod_1 = require("zod");
var server_di_container_service_1 = require("@src/services/app-di-container/server-di-container.service");
var requestExecutionContext_1 = require("../requestExecutionContext");
var defineServerSideProps_1 = require("./defineServerSideProps");
describe(defineServerSideProps_1.defineServerSideProps, function () {
    it("returns empty props when no schema, if condition, or handler provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({ route: "/test" })];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual({ props: {} });
                    return [2 /*return*/];
            }
        });
    }); });
    it("executes handler and returns its result", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockHandler, customServices, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });
                    customServices = {
                        userTracker: (0, jest_mock_extended_1.mock)(),
                        getSession: jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, null];
                        }); }); })
                    };
                    return [4 /*yield*/, setup({
                            route: "/test",
                            handler: mockHandler,
                            context: {
                                services: customServices
                            }
                        })];
                case 1:
                    result = _a.sent();
                    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
                        services: __assign(__assign({}, server_di_container_service_1.services), customServices)
                    }));
                    expect(result).toEqual({ props: { data: "test" } });
                    return [2 /*return*/];
            }
        });
    }); });
    it("tracks current user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockHandler, session, customServices, req, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });
                    session = {
                        user: {
                            id: "123"
                        }
                    };
                    customServices = {
                        userTracker: (0, jest_mock_extended_1.mock)(),
                        getSession: jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, session];
                        }); }); })
                    };
                    req = createRequest();
                    res = (0, jest_mock_extended_1.mock)();
                    return [4 /*yield*/, setup({
                            route: "/test",
                            handler: mockHandler,
                            context: {
                                services: customServices,
                                req: req,
                                res: res
                            }
                        })];
                case 1:
                    _a.sent();
                    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
                        session: session
                    }));
                    expect(customServices.userTracker.track).toHaveBeenCalledWith(session.user);
                    expect(customServices.getSession).toHaveBeenCalledWith(req, res);
                    return [2 /*return*/];
            }
        });
    }); });
    it("validates context with schema when provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var schema, mockHandler, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schema = zod_1.z.object({
                        query: zod_1.z.object({
                            id: zod_1.z.string().transform(Number)
                        }),
                        params: zod_1.z.object({
                            username: zod_1.z.string()
                        })
                    });
                    mockHandler = jest.fn().mockResolvedValue({ props: { validated: true } });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            schema: schema,
                            handler: mockHandler,
                            context: {
                                query: { id: "123" },
                                params: { username: "test" }
                            }
                        })];
                case 1:
                    result = _a.sent();
                    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
                        query: { id: 123 },
                        params: { username: "test" }
                    }));
                    expect(result).toEqual({ props: { validated: true } });
                    return [2 /*return*/];
            }
        });
    }); });
    it("return NOT_FOUND when schema validation fails", function () { return __awaiter(void 0, void 0, void 0, function () {
        var schema, logger, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schema = zod_1.z.object({
                        query: zod_1.z.object({
                            id: zod_1.z.string()
                        })
                    });
                    logger = (0, jest_mock_extended_1.mock)();
                    return [4 /*yield*/, setup({
                            route: "/test",
                            schema: schema,
                            context: {
                                query: {},
                                services: {
                                    logger: logger
                                }
                            }
                        })];
                case 1:
                    result = _a.sent();
                    expect(logger.warn).toHaveBeenCalledWith({
                        message: "Invalid context for route /test",
                        error: expect.any(zod_1.ZodError)
                    });
                    expect(result).toEqual({ notFound: true });
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns notFound when if condition returns false", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({
                        route: "/test",
                        if: function () { return false; }
                    })];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual({ notFound: true });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: function () { return Promise.resolve(false); }
                        })];
                case 2:
                    result = _a.sent();
                    expect(result).toEqual({ notFound: true });
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns redirect when if condition returns redirect result", function () { return __awaiter(void 0, void 0, void 0, function () {
        var redirectResult, mockIf, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    redirectResult = {
                        redirect: {
                            destination: "/login",
                            permanent: false
                        }
                    };
                    mockIf = jest.fn().mockReturnValue(redirectResult);
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: mockIf
                        })];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual(redirectResult);
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls handler when if condition returns true", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockIf, mockHandler, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockIf = jest.fn().mockReturnValue(true);
                    mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: mockIf,
                            handler: mockHandler
                        })];
                case 1:
                    result = _a.sent();
                    expect(mockHandler).toHaveBeenCalled();
                    expect(result).toEqual({ props: { data: "test" } });
                    return [2 /*return*/];
            }
        });
    }); });
    it("executes handler when if condition returns Promise<true>", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockIf, mockHandler, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockIf = jest.fn().mockResolvedValue(true);
                    mockHandler = jest.fn().mockResolvedValue({ props: { data: "test" } });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: mockIf,
                            handler: mockHandler
                        })];
                case 1:
                    result = _a.sent();
                    expect(mockHandler).toHaveBeenCalled();
                    expect(result).toEqual({ props: { data: "test" } });
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles async if condition that returns GetServerSidePropsResult", function () { return __awaiter(void 0, void 0, void 0, function () {
        var asyncIfResult, mockIf, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    asyncIfResult = {
                        redirect: {
                            destination: "/error",
                            permanent: true
                        }
                    };
                    mockIf = jest.fn().mockResolvedValue(asyncIfResult);
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: mockIf
                        })];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual(asyncIfResult);
                    return [2 /*return*/];
            }
        });
    }); });
    it("exposes request headers in async context", function () { return __awaiter(void 0, void 0, void 0, function () {
        var headers, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = { "x-forwarded-for": "127.0.0.1", host: "localhost" };
                    return [4 /*yield*/, setup({
                            route: "/test",
                            context: {
                                req: createRequest({ headers: headers })
                            },
                            handler: function () { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                return [2 /*return*/, ({ props: { headers: (_a = requestExecutionContext_1.requestExecutionContext.getStore()) === null || _a === void 0 ? void 0 : _a.headers } })];
                            }); }); }
                        })];
                case 1:
                    result = (_a.sent());
                    expect(Object.fromEntries(result.props.headers.entries())).toEqual(expect.objectContaining(headers));
                    return [2 /*return*/];
            }
        });
    }); });
    it("executes async & sync handlers", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({
                        route: "/test",
                        handler: function () { return ({ props: { async: true } }); }
                    })];
                case 1:
                    result = _a.sent();
                    expect(result).toEqual({ props: { async: true } });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            handler: function () { return Promise.resolve({ props: { sync: true } }); }
                        })];
                case 2:
                    result = _a.sent();
                    expect(result).toEqual({ props: { sync: true } });
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles if condition that returns undefined and null", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockHandler, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockHandler = jest.fn().mockResolvedValue({ props: { handled: true } });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: jest.fn().mockReturnValue(undefined),
                            handler: mockHandler
                        })];
                case 1:
                    result = _a.sent();
                    expect(mockHandler).toHaveBeenCalled();
                    expect(result).toEqual({ props: { handled: true } });
                    return [4 /*yield*/, setup({
                            route: "/test",
                            if: jest.fn().mockReturnValue(null),
                            handler: mockHandler
                        })];
                case 2:
                    result = _a.sent();
                    expect(mockHandler).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns NOT_FOUND when handler throws 400 AxiosError", function () { return __awaiter(void 0, void 0, void 0, function () {
        var validationError, logger, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    validationError = new axios_1.AxiosError("Bad request", "400", undefined, undefined, {
                        status: 400,
                        statusText: "Bad request",
                        data: { message: "bad request" },
                        headers: {},
                        config: {}
                    });
                    logger = (0, jest_mock_extended_1.mock)();
                    return [4 /*yield*/, setup({
                            route: "/test",
                            handler: function () { return Promise.reject(validationError); },
                            context: {
                                services: (0, jest_mock_extended_1.mock)({
                                    logger: logger
                                })
                            }
                        })];
                case 1:
                    result = _a.sent();
                    expect(logger.warn).toHaveBeenCalledWith({
                        message: "Error in handler for route /test",
                        error: validationError
                    });
                    expect(result).toEqual({ notFound: true });
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns NOT_FOUND when handler throws 404 AxiosError", function () { return __awaiter(void 0, void 0, void 0, function () {
        var notFoundError, logger, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    notFoundError = new axios_1.AxiosError("Not Found", "404", undefined, undefined, {
                        status: 404,
                        statusText: "Not Found",
                        data: { message: "Resource not found" },
                        headers: {},
                        config: {}
                    });
                    logger = (0, jest_mock_extended_1.mock)();
                    return [4 /*yield*/, setup({
                            route: "/test",
                            handler: function () { return Promise.reject(notFoundError); },
                            context: {
                                services: (0, jest_mock_extended_1.mock)({
                                    logger: logger
                                })
                            }
                        })];
                case 1:
                    result = _a.sent();
                    expect(logger.warn).toHaveBeenCalledWith({
                        message: "Error in handler for route /test",
                        error: notFoundError
                    });
                    expect(result).toEqual({ notFound: true });
                    return [2 /*return*/];
            }
        });
    }); });
    it("throws other AxiosError status codes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var axiosError, mockHandler;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    axiosError = new axios_1.AxiosError("Internal Server Error", "500", undefined, undefined, {
                        status: 500,
                        statusText: "Internal Server Error",
                        data: { message: "Server error" },
                        headers: {},
                        config: {}
                    });
                    mockHandler = jest.fn().mockRejectedValue(axiosError);
                    return [4 /*yield*/, expect(setup({
                            route: "/test",
                            handler: mockHandler
                        })).rejects.toThrow("Internal Server Error")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("throws non-AxiosError exceptions", function () { return __awaiter(void 0, void 0, void 0, function () {
        var error, mockHandler;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    error = new Error("Custom error");
                    mockHandler = jest.fn().mockRejectedValue(error);
                    return [4 /*yield*/, expect(setup({
                            route: "/test",
                            handler: mockHandler
                        })).rejects.toThrow("Custom error")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        var _this = this;
        var _a;
        var context = __assign(__assign({ req: createRequest(), res: (0, jest_mock_extended_1.mock)(), query: {}, params: {}, resolvedUrl: "/test", locale: "en", locales: ["en"], defaultLocale: "en", session: null }, input.context), { services: __assign(__assign(__assign({}, server_di_container_service_1.services), { userTracker: (0, jest_mock_extended_1.mock)(), getSession: jest.fn(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, null];
                }); }); }) }), (_a = input.context) === null || _a === void 0 ? void 0 : _a.services) });
        return (0, defineServerSideProps_1.defineServerSideProps)({
            route: input.route,
            schema: input.schema,
            if: input.if,
            handler: input.handler
        })(context);
    }
    function createRequest(_a) {
        if (_a === void 0) { _a = {}; }
        var headers = _a.headers, input = __rest(_a, ["headers"]);
        return (0, jest_mock_extended_1.mock)(__assign({ url: "/test", headers: __assign({ host: "localhost", "content-type": "application/json", "x-forwarded-host": "localhost", "x-forwarded-for": "127.0.0.1", "x-forwarded-proto": "http" }, headers) }, input));
    }
});
