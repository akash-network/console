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
var jest_mock_extended_1 = require("jest-mock-extended");
var zod_1 = require("zod");
var server_di_container_service_1 = require("@src/services/app-di-container/server-di-container.service");
var defineApiHandler_1 = require("./defineApiHandler");
describe("defineApiHandler", function () {
    it("creates a handler that calls the provided handler function", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handler, req, res, customServices;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handler = jest.fn().mockResolvedValue(undefined);
                    req = createRequest({
                        query: { a: "1" },
                        body: { b: "2" }
                    });
                    res = (0, jest_mock_extended_1.mock)();
                    customServices = {
                        userTracker: (0, jest_mock_extended_1.mock)(),
                        getSession: jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, null];
                        }); }); })
                    };
                    return [4 /*yield*/, setup({
                            context: {
                                req: req,
                                res: res,
                                services: customServices
                            },
                            handler: handler
                        })];
                case 1:
                    _a.sent();
                    expect(handler).toHaveBeenCalledWith({
                        req: req,
                        res: res,
                        services: __assign(__assign({}, server_di_container_service_1.services), customServices),
                        query: req.query,
                        body: req.body,
                        session: null
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("tracks current user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handler, req, res, session, customServices;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handler = jest.fn().mockResolvedValue(undefined);
                    req = createRequest({
                        query: { a: "1" },
                        body: { b: "2" }
                    });
                    res = (0, jest_mock_extended_1.mock)();
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
                    return [4 /*yield*/, setup({
                            context: {
                                req: req,
                                res: res,
                                services: customServices
                            },
                            handler: handler
                        })];
                case 1:
                    _a.sent();
                    expect(customServices.userTracker.track).toHaveBeenCalledWith(session.user);
                    expect(customServices.getSession).toHaveBeenCalledWith(req, res);
                    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                        session: session
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    it("validates request with schema when provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var schema, handler, req;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schema = zod_1.z.object({
                        query: zod_1.z.object({
                            id: zod_1.z.string()
                        }),
                        body: zod_1.z.object({
                            name: zod_1.z.string(),
                            age: zod_1.z.string().transform(Number)
                        })
                    });
                    handler = jest.fn().mockResolvedValue(undefined);
                    req = createRequest({
                        query: { id: "123" },
                        body: { name: "test", age: "10" }
                    });
                    return [4 /*yield*/, setup({
                            schema: schema,
                            handler: handler,
                            context: {
                                req: req
                            }
                        })];
                case 1:
                    _a.sent();
                    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                        req: req,
                        query: { id: "123" },
                        body: { name: "test", age: 10 }
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns 400 error and logs warning when schema validation fails", function () { return __awaiter(void 0, void 0, void 0, function () {
        var schema, handler, logger, req, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    schema = zod_1.z.object({
                        query: zod_1.z.object({
                            id: zod_1.z.string()
                        }),
                        body: zod_1.z.object({
                            name: zod_1.z.string()
                        })
                    });
                    handler = jest.fn();
                    logger = (0, jest_mock_extended_1.mock)();
                    req = createRequest({
                        query: { id: "123" },
                        body: { invalid: "data" }
                    });
                    res = (0, jest_mock_extended_1.mock)();
                    return [4 /*yield*/, setup({
                            schema: schema,
                            handler: handler,
                            context: {
                                req: req,
                                res: res,
                                services: {
                                    logger: logger
                                }
                            }
                        })];
                case 1:
                    _a.sent();
                    expect(handler).not.toHaveBeenCalled();
                    expect(res.status).toHaveBeenCalledWith(400);
                    expect(res.json).toHaveBeenCalledWith({
                        errors: expect.arrayContaining([
                            expect.objectContaining({
                                message: expect.any(String),
                                path: expect.any(Array)
                            })
                        ])
                    });
                    expect(logger.warn).toHaveBeenCalledWith({
                        error: expect.any(zod_1.z.ZodError),
                        event: "INVALID_API_REQUEST"
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        var _this = this;
        var _a, _b, _c;
        var req = ((_a = input.context) === null || _a === void 0 ? void 0 : _a.req) || createRequest();
        var res = ((_b = input.context) === null || _b === void 0 ? void 0 : _b.res) || (0, jest_mock_extended_1.mock)();
        req[defineApiHandler_1.REQ_SERVICES_KEY] = __assign(__assign(__assign({}, server_di_container_service_1.services), { getSession: jest.fn(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, null];
            }); }); }), userTracker: (0, jest_mock_extended_1.mock)() }), (_c = input.context) === null || _c === void 0 ? void 0 : _c.services);
        var handler = (0, defineApiHandler_1.defineApiHandler)({
            route: input.route || "/test",
            schema: input.schema,
            handler: input.handler || (function () { })
        });
        return handler(req, res);
    }
    function createRequest(input) {
        return (0, jest_mock_extended_1.mock)(__assign({ headers: {
                "content-type": "application/json",
                "x-forwarded-host": "localhost",
                "x-forwarded-for": "127.0.0.1",
                "x-forwarded-proto": "http"
            } }, input));
    }
});
