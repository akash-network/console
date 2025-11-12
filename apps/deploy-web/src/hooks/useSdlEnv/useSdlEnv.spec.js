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
var react_hook_form_1 = require("react-hook-form");
var zod_1 = require("zod");
var useSdlEnv_1 = require("./useSdlEnv");
var react_1 = require("@testing-library/react");
var sdlService_1 = require("@tests/seeders/sdlService");
describe("useSdlEnv", function () {
    it("initializes with empty environment variables", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    result = (_a.sent()).result;
                    expect(result.current.values.API_KEY).toBeUndefined();
                    expect(result.current.values.DATABASE_URL).toBeUndefined();
                    expect(result.current.errors).toEqual({});
                    return [2 /*return*/];
            }
        });
    }); });
    it("sets and gets environment variable values", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    result = (_a.sent()).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.setValue("API_KEY", "secret-key-123");
                                result.current.setValue("DATABASE_URL", "postgresql://localhost:5432/mydb");
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    expect(result.current.values.API_KEY).toBe("secret-key-123");
                    expect(result.current.values.DATABASE_URL).toBe("postgresql://localhost:5432/mydb");
                    return [2 /*return*/];
            }
        });
    }); });
    it("removes environment variable when value is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    result = (_a.sent()).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.setValue("API_KEY", "secret-key-123");
                                result.current.setValue("API_KEY", "");
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    expect(result.current.values.API_KEY).toBe("");
                    return [2 /*return*/];
            }
        });
    }); });
    it("updates existing environment variable", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    result = (_a.sent()).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.setValue("API_KEY", "old-key");
                                result.current.setValue("API_KEY", "new-key");
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    expect(result.current.values.API_KEY).toBe("new-key");
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles validation errors from schema", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.setValue("API_KEY", "");
                                result.current.setValue("DATABASE_URL", "invalid-url");
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                form.setError("services.0.env", { type: "manual", message: "invalid env" });
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                form.handleSubmit(function () { });
                                return [2 /*return*/];
                            });
                        }); })];
                case 4:
                    _b.sent();
                    expect(result.current.errors.API_KEY).toBe("API key is required");
                    expect(result.current.errors.DATABASE_URL).toBe("Invalid database URL");
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles multiple environment variables correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    result = (_a.sent()).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.setValue("API_KEY", "key1");
                                result.current.setValue("DATABASE_URL", "url1");
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    expect(result.current.values.API_KEY).toBe("key1");
                    expect(result.current.values.DATABASE_URL).toBe("url1");
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns undefined for keys without values", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    result = (_a.sent()).result;
                    expect(result.current.values.DEBUG).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, void 0, void 0, function () {
            var testSchema, methods, TestWrapper, defaultFormValues, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        testSchema = zod_1.z.object({
                            API_KEY: zod_1.z.string().min(1, "API key is required"),
                            DATABASE_URL: zod_1.z.string().url("Invalid database URL"),
                            DEBUG: zod_1.z.boolean().optional()
                        });
                        TestWrapper = function (_a) {
                            var children = _a.children, defaultValues = _a.defaultValues;
                            methods = (0, react_hook_form_1.useForm)({
                                defaultValues: defaultValues
                            });
                            return <react_hook_form_1.FormProvider {...methods}>{children}</react_hook_form_1.FormProvider>;
                        };
                        defaultFormValues = {
                            services: [(0, sdlService_1.buildSDLService)({ env: [] })],
                            imageList: [],
                            hasSSHKey: false
                        };
                        result = (0, react_1.renderHook)(function () {
                            return (0, useSdlEnv_1.useSdlEnv)({
                                serviceIndex: 0,
                                schema: testSchema
                            });
                        }, {
                            wrapper: function (_a) {
                                var children = _a.children;
                                return <TestWrapper defaultValues={defaultFormValues}>{children}</TestWrapper>;
                            }
                        }).result;
                        _a = {
                            result: result
                        };
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return methods; })];
                    case 1: return [2 /*return*/, (_a.form = _b.sent(),
                            _a)];
                }
            });
        });
    }
});
