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
var react_1 = require("react");
var test_utils_1 = require("react-dom/test-utils");
var jest_mock_extended_1 = require("jest-mock-extended");
var promises_1 = require("node:timers/promises");
var Turnstile_1 = require("./Turnstile");
var react_2 = require("@testing-library/react");
var mocks_1 = require("@tests/unit/mocks");
describe(Turnstile_1.Turnstile.name, function () {
    it("does not render if turnstile is disabled", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({ enabled: false })];
                case 1:
                    _a.sent();
                    expect(react_2.screen.queryByText("Turnstile")).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not patch fetch API if turnstile is disabled", function () { return __awaiter(void 0, void 0, void 0, function () {
        var originalFetch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    originalFetch = window.fetch;
                    return [4 /*yield*/, setup({ enabled: false })];
                case 1:
                    _a.sent();
                    expect(window.fetch).toBe(originalFetch);
                    return [2 /*return*/];
            }
        });
    }); });
    it("patches fetch API if turnstile is enabled", function () { return __awaiter(void 0, void 0, void 0, function () {
        var originalFetch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    originalFetch = window.fetch;
                    return [4 /*yield*/, setup({ enabled: true })];
                case 1:
                    _a.sent();
                    expect(window.fetch).not.toBe(originalFetch);
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders turnstile widget", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({ enabled: true })];
                case 1:
                    _a.sent();
                    expect(react_2.screen.queryByText("Turnstile")).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it("resets actual widget on error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var turnstileInstance, ReactTurnstile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    turnstileInstance = (0, jest_mock_extended_1.mock)();
                    ReactTurnstile = (0, react_1.forwardRef)(function (props, ref) {
                        useForwardedRef(ref, turnstileInstance);
                        (0, react_1.useEffect)(function () {
                            var _a;
                            (_a = props.onError) === null || _a === void 0 ? void 0 : _a.call(props, "test");
                        }, []);
                        return <div>Turnstile</div>;
                    });
                    return [4 /*yield*/, setup({ enabled: true, components: { ReactTurnstile: ReactTurnstile } })];
                case 1:
                    _a.sent();
                    expect(turnstileInstance.remove).toHaveBeenCalled();
                    expect(turnstileInstance.render).toHaveBeenCalled();
                    expect(turnstileInstance.execute).toHaveBeenCalled();
                    expect(react_2.screen.queryByText("Some error occurred")).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('resets actual widget on "Retry" button click', function () { return __awaiter(void 0, void 0, void 0, function () {
        var turnstileInstance, ReactTurnstile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    turnstileInstance = (0, jest_mock_extended_1.mock)();
                    ReactTurnstile = (0, react_1.forwardRef)(function (props, ref) {
                        useForwardedRef(ref, turnstileInstance);
                        return <div>Turnstile</div>;
                    });
                    return [4 /*yield*/, setup({
                            enabled: true,
                            components: {
                                ReactTurnstile: ReactTurnstile,
                                Button: (0, react_1.forwardRef)(function (props, ref) { return (<button type="button" {...props} ref={ref} onClick={props.onClick}>
            {props.children}
          </button>); })
                            }
                        })];
                case 1:
                    _a.sent();
                    react_2.fireEvent.click(react_2.screen.getByRole("button", { name: "Retry" }));
                    expect(turnstileInstance.remove).toHaveBeenCalled();
                    expect(turnstileInstance.render).toHaveBeenCalled();
                    expect(turnstileInstance.execute).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it('removes actual widget on "Dismiss" button click', function () { return __awaiter(void 0, void 0, void 0, function () {
        var turnstileInstance, ReactTurnstile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    turnstileInstance = (0, jest_mock_extended_1.mock)();
                    ReactTurnstile = (0, react_1.forwardRef)(function (props, ref) {
                        useForwardedRef(ref, turnstileInstance);
                        return <div>Turnstile</div>;
                    });
                    return [4 /*yield*/, setup({
                            enabled: true,
                            components: {
                                ReactTurnstile: ReactTurnstile,
                                Button: (0, react_1.forwardRef)(function (props, ref) { return (<button type="button" {...props} ref={ref} onClick={props.onClick}>
            {props.children}
          </button>); })
                            }
                        })];
                case 1:
                    _a.sent();
                    react_2.fireEvent.click(react_2.screen.getByRole("button", { name: "Dismiss" }));
                    expect(turnstileInstance.remove).toHaveBeenCalled();
                    expect(turnstileInstance.render).not.toHaveBeenCalled();
                    expect(turnstileInstance.execute).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    describe("when CF-Mitigated header is present", function () {
        var originalFetch;
        beforeEach(function () {
            originalFetch = globalThis.fetch;
            var amountOfCalls = 0;
            globalThis.fetch = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    if (amountOfCalls > 0) {
                        return [2 /*return*/, new Response("done", {
                                status: 200
                            })];
                    }
                    response = new Response("", {
                        status: 403,
                        headers: new Headers({ "cf-mitigated": "challenge" })
                    });
                    amountOfCalls++;
                    return [2 /*return*/, response];
                });
            }); });
        });
        afterEach(function () {
            globalThis.fetch = originalFetch;
        });
        it("renders turnstile widget", function () { return __awaiter(void 0, void 0, void 0, function () {
            var turnstileInstance, ReactTurnstile;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        turnstileInstance = (0, jest_mock_extended_1.mock)();
                        ReactTurnstile = (0, react_1.forwardRef)(function (props, ref) {
                            useForwardedRef(ref, turnstileInstance);
                            return <div>Turnstile</div>;
                        });
                        return [4 /*yield*/, setup({ enabled: true, components: { ReactTurnstile: ReactTurnstile } })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, fetch("/")];
                    case 2:
                        _a.sent();
                        expect(turnstileInstance.render).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it('does not retry request if "Dismiss" button is clicked', function () { return __awaiter(void 0, void 0, void 0, function () {
            var fetchMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchMock = globalThis.fetch;
                        return [4 /*yield*/, setup({
                                enabled: true,
                                components: {
                                    Button: (0, react_1.forwardRef)(function (props, ref) { return (<button type="button" {...props} ref={ref} onClick={props.onClick}>
              {props.children}
            </button>); })
                                }
                            })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, fetch("/")];
                    case 2:
                        _a.sent();
                        react_2.fireEvent.click(react_2.screen.getByRole("button", { name: "Dismiss" }));
                        expect(fetchMock).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it("retries request if challenge is solved", function () { return __awaiter(void 0, void 0, void 0, function () {
            var fetchMock, turnstileInstance, ReactTurnstile;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchMock = globalThis.fetch;
                        turnstileInstance = (0, jest_mock_extended_1.mock)({
                            getResponsePromise: function () { return Promise.resolve("test response"); }
                        });
                        ReactTurnstile = (0, react_1.forwardRef)(function (props, ref) {
                            useForwardedRef(ref, turnstileInstance);
                            return <div>Turnstile</div>;
                        });
                        return [4 /*yield*/, setup({ enabled: true, components: { ReactTurnstile: ReactTurnstile } })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, fetch("/")];
                    case 2:
                        _a.sent();
                        expect(fetchMock).toHaveBeenCalledTimes(2);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(input) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = (0, react_2.render)(<Turnstile_1.Turnstile enabled={!!(input === null || input === void 0 ? void 0 : input.enabled)} siteKey="unittest-site-key" components={(0, mocks_1.MockComponents)(Turnstile_1.COMPONENTS, __assign({ ReactTurnstile: (0, react_1.forwardRef)(function (_, ref) {
                                    useForwardedRef(ref);
                                    return <div>Turnstile</div>;
                                }) }, input === null || input === void 0 ? void 0 : input.components))}/>);
                        return [4 /*yield*/, (0, test_utils_1.act)(function () { return (0, promises_1.setTimeout)(0); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    }
    function useForwardedRef(ref, instance) {
        if (instance === void 0) { instance = (0, jest_mock_extended_1.mock)(); }
        (0, react_1.useEffect)(function () {
            if (typeof ref === "function") {
                ref(instance);
            }
            else if (ref) {
                ref.current = instance;
            }
        }, []);
    }
});
