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
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var jest_mock_extended_1 = require("jest-mock-extended");
var LogCollectorControl_1 = require("./LogCollectorControl");
var react_1 = require("@testing-library/react");
var user_event_1 = require("@testing-library/user-event");
var sdlService_1 = require("@tests/seeders/sdlService");
describe(LogCollectorControl_1.LogCollectorControl.name, function () {
    beforeAll(function () {
        global.ResizeObserver = jest.fn().mockImplementation(function () { return (0, jest_mock_extended_1.mock)(); });
    });
    it("adds log-collector service when checkbox is checked", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, user, form, targetService, checkbox, formValues, logCollectorService;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), user = _a.user, form = _a.form, targetService = _a.targetService;
                    checkbox = react_1.screen.getByRole("checkbox");
                    return [4 /*yield*/, user.click(checkbox)];
                case 2:
                    _b.sent();
                    formValues = form.getValues();
                    expect(formValues.services).toHaveLength(2);
                    logCollectorService = formValues.services.find(function (service) { return service.title === "".concat(targetService.title, "-log-collector"); });
                    expect(logCollectorService).toBeDefined();
                    expect(logCollectorService === null || logCollectorService === void 0 ? void 0 : logCollectorService.image).toMatch(/ghcr\.io\/akash-network\/log-collector:\d+\.\d+\.\d+/);
                    expect(logCollectorService === null || logCollectorService === void 0 ? void 0 : logCollectorService.placement).toMatchObject(targetService.placement);
                    return [2 /*return*/];
            }
        });
    }); });
    it("removes log-collector service when checkbox is unchecked", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, user, form, targetService, checkbox, formValues, logCollectorService;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), user = _a.user, form = _a.form, targetService = _a.targetService;
                    checkbox = react_1.screen.getByRole("checkbox");
                    return [4 /*yield*/, user.click(checkbox)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, user.click(checkbox)];
                case 3:
                    _b.sent();
                    formValues = form.getValues();
                    expect(formValues.services).toHaveLength(1);
                    logCollectorService = formValues.services.find(function (service) { return service.title === "".concat(targetService.title, "-log-collector"); });
                    expect(logCollectorService).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    it("removes log-collector service when target service is removed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, user, form, checkbox;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), user = _a.user, form = _a.form;
                    checkbox = react_1.screen.getByRole("checkbox");
                    return [4 /*yield*/, user.click(checkbox)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                form.setValue("services", [form.getValues("services.1")]);
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    expect(form.getValues("services.1")).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
    it("updates log-collector service title when target service title is changed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, user, form, checkbox;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), user = _a.user, form = _a.form;
                    checkbox = react_1.screen.getByRole("checkbox");
                    return [4 /*yield*/, user.click(checkbox)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                form.setValue("services.0.title", "new-title");
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                expect(form.getValues("services.1.title")).toBe("new-title-log-collector");
                                return [2 /*return*/];
                            });
                        }); })];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("updates log-collector pod selector label when target service title is changed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, user, form, checkbox;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), user = _a.user, form = _a.form;
                    checkbox = react_1.screen.getByRole("checkbox");
                    return [4 /*yield*/, user.click(checkbox)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                form.setValue("services.0.title", "new-title");
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var selector;
                            var _a;
                            return __generator(this, function (_b) {
                                selector = (_a = form.getValues("services.1.env")) === null || _a === void 0 ? void 0 : _a.find(function (env) { return env.key === "POD_LABEL_SELECTOR"; });
                                expect(selector === null || selector === void 0 ? void 0 : selector.value).toBe('"akash.network/manifest-service=new-title"');
                                return [2 /*return*/];
                            });
                        }); })];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("updates log-collector placement when target service placement is changed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, user, form, checkbox, newPlacement;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), user = _a.user, form = _a.form;
                    checkbox = react_1.screen.getByRole("checkbox");
                    return [4 /*yield*/, user.click(checkbox)];
                case 2:
                    _b.sent();
                    newPlacement = (0, sdlService_1.buildSDLService)().placement;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                form.setValue("services.0.placement", newPlacement);
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(form.getValues("services.1.placement.name")).toBe(newPlacement.name);
                        }, { timeout: 1000 })];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, void 0, void 0, function () {
            var targetService, formValues, maybeForm, TestWrapper, user, result, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        targetService = (0, sdlService_1.buildSDLService)();
                        formValues = {
                            services: [targetService]
                        };
                        TestWrapper = function (_a) {
                            var children = _a.children;
                            var methods = (0, react_hook_form_1.useForm)({
                                defaultValues: formValues
                            });
                            maybeForm = methods;
                            return <react_hook_form_1.FormProvider {...methods}>{children}</react_hook_form_1.FormProvider>;
                        };
                        user = user_event_1.default.setup();
                        result = (0, react_1.render)(<components_1.TooltipProvider>
        <TestWrapper>
          <LogCollectorControl_1.LogCollectorControl serviceIndex={0}/>
        </TestWrapper>
      </components_1.TooltipProvider>);
                        _a = [__assign({}, result)];
                        _b = { user: user };
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return maybeForm; })];
                    case 1: return [2 /*return*/, __assign.apply(void 0, _a.concat([(_b.form = _c.sent(), _b.targetService = targetService, _b)]))];
                }
            });
        });
    }
});
