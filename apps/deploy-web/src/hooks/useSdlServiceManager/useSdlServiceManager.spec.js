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
var useSdlServiceManager_1 = require("./useSdlServiceManager");
var react_1 = require("@testing-library/react");
var sdlService_1 = require("@tests/seeders/sdlService");
describe(useSdlServiceManager_1.useSdlServiceManager.name, function () {
    it("adds a new service with correct title", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(1);
                    expect(currentServices[0].title).toBe("service-1");
                    return [2 /*return*/];
            }
        });
    }); });
    it("adds multiple services with sequential titles", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 4:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(3);
                    expect(currentServices[0].title).toBe("service-1");
                    expect(currentServices[1].title).toBe("service-2");
                    expect(currentServices[2].title).toBe("service-3");
                    return [2 /*return*/];
            }
        });
    }); });
    it("adds services with correct titles when existing services have gaps", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: [(0, sdlService_1.buildSDLService)({ title: "service-1" }), (0, sdlService_1.buildSDLService)({ title: "service-3" }), (0, sdlService_1.buildSDLService)({ title: "service-5" })]
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(4);
                    expect(currentServices[3].title).toBe("service-6");
                    return [2 /*return*/];
            }
        });
    }); });
    it("removes a service by index", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: [(0, sdlService_1.buildSDLService)({ title: "service-1" }), (0, sdlService_1.buildSDLService)({ title: "service-2" }), (0, sdlService_1.buildSDLService)({ title: "service-3" })]
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.remove(1);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(2);
                    expect(currentServices[0].title).toBe("service-1");
                    expect(currentServices[1].title).toBe("service-3");
                    return [2 /*return*/];
            }
        });
    }); });
    it("removes a service and its associated log collector service", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: [
                            (0, sdlService_1.buildSDLService)({ title: "service-1" }),
                            (0, sdlService_1.buildSDLService)({
                                title: "service-1-log-collector",
                                image: "ghcr.io/akash-network/log-collector:1.7.0"
                            }),
                            (0, sdlService_1.buildSDLService)({ title: "service-2" })
                        ]
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.remove(0);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(1);
                    expect(currentServices[0].title).toBe("service-2");
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles removal when no log collector service exists", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: [(0, sdlService_1.buildSDLService)({ title: "service-1" }), (0, sdlService_1.buildSDLService)({ title: "service-2" })]
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.remove(0);
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(1);
                    expect(currentServices[0].title).toBe("service-2");
                    return [2 /*return*/];
            }
        });
    }); });
    it("ignores log collector services when calculating next service title", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: [
                            (0, sdlService_1.buildSDLService)({ title: "service-1" }),
                            (0, sdlService_1.buildSDLService)({
                                title: "service-1-log-collector",
                                image: "ghcr.io/akash-network/log-collector:1.7.0"
                            }),
                            (0, sdlService_1.buildSDLService)({ title: "service-3" })
                        ]
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(4);
                    expect(currentServices[3].title).toBe("service-4");
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles services with non-standard titles", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: [(0, sdlService_1.buildSDLService)({ title: "custom-service" }), (0, sdlService_1.buildSDLService)({ title: "another-service" })]
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(3);
                    expect(currentServices[2].title).toBe("service-3");
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles empty services array", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, result, form, currentServices;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup({
                        defaultServices: []
                    })];
                case 1:
                    _a = _b.sent(), result = _a.result, form = _a.form;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                result.current.add();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    currentServices = form.getValues("services");
                    expect(currentServices).toHaveLength(1);
                    expect(currentServices[0].title).toBe("service-1");
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, arguments, void 0, function (_a) {
            var methods, TestWrapper, defaultFormValues, result;
            var _b;
            var _c = _a === void 0 ? {} : _a, _d = _c.defaultServices, defaultServices = _d === void 0 ? [] : _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        TestWrapper = function (_a) {
                            var children = _a.children, defaultValues = _a.defaultValues;
                            methods = (0, react_hook_form_1.useForm)({
                                defaultValues: defaultValues
                            });
                            return <react_hook_form_1.FormProvider {...methods}>{children}</react_hook_form_1.FormProvider>;
                        };
                        defaultFormValues = {
                            services: defaultServices,
                            imageList: [],
                            hasSSHKey: false
                        };
                        result = (0, react_1.renderHook)(function () {
                            return (0, useSdlServiceManager_1.useSdlServiceManager)({
                                control: methods.control
                            });
                        }, {
                            wrapper: function (_a) {
                                var children = _a.children;
                                return <TestWrapper defaultValues={defaultFormValues}>{children}</TestWrapper>;
                            }
                        }).result;
                        _b = {
                            result: result
                        };
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return methods; })];
                    case 1: return [2 /*return*/, (_b.form = _e.sent(),
                            _b)];
                }
            });
        });
    }
});
