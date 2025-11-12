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
var ProviderRawData_1 = require("@src/components/providers/ProviderRawData/ProviderRawData");
var react_1 = require("@testing-library/react");
var provider_1 = require("@tests/seeders/provider");
var mocks_1 = require("@tests/unit/mocks");
var TestContainerProvider_1 = require("@tests/unit/TestContainerProvider");
describe(ProviderRawData_1.ProviderRawData.name, function () {
    it("renders", function () { return __awaiter(void 0, void 0, void 0, function () {
        var components, provider;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    components = (0, mocks_1.MockComponents)(ProviderRawData_1.COMPONENTS);
                    provider = (0, provider_1.buildProvider)();
                    return [4 /*yield*/, setup({ components: components, provider: provider })];
                case 1:
                    _a.sent();
                    expect(components.Layout).toHaveBeenCalled();
                    expect(components.CustomNextSeo).toHaveBeenCalled();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () { return expect(components.ProviderDetailLayout).toHaveBeenCalledWith(expect.objectContaining({ address: provider.owner, provider: provider }), {}); })];
                case 2:
                    _a.sent();
                    expect(components.DynamicReactJson).toHaveBeenCalledWith(expect.objectContaining({ src: JSON.parse(JSON.stringify(provider)) }), {});
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(props) {
        return __awaiter(this, void 0, void 0, function () {
            var publicConsoleApiHttpClient, chainApiHttpClient, providerProxy, result;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        publicConsoleApiHttpClient = function () {
                            return ({
                                get: jest.fn(function (url) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        if (url.includes("/providers/"))
                                            return [2 /*return*/, {
                                                    data: (props === null || props === void 0 ? void 0 : props.provider) || (0, provider_1.buildProvider)()
                                                }];
                                        throw new Error("unexpected request: ".concat(url));
                                    });
                                }); })
                            });
                        };
                        chainApiHttpClient = function () {
                            return ({
                                get: jest.fn(function (url) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        if (url.includes("/leases/"))
                                            return [2 /*return*/, { data: [] }];
                                        throw new Error("unexpected request: ".concat(url));
                                    });
                                }); })
                            });
                        };
                        providerProxy = function () {
                            return ({
                                fetchProviderUrl: jest.fn(function () {
                                    return new Promise(function () { });
                                })
                            });
                        };
                        result = (0, react_1.render)(<TestContainerProvider_1.TestContainerProvider services={{ chainApiHttpClient: chainApiHttpClient, publicConsoleApiHttpClient: publicConsoleApiHttpClient, providerProxy: providerProxy }}>
        <ProviderRawData_1.ProviderRawData owner={((_a = props === null || props === void 0 ? void 0 : props.provider) === null || _a === void 0 ? void 0 : _a.owner) || "test"} components={(0, mocks_1.MockComponents)(ProviderRawData_1.COMPONENTS, props === null || props === void 0 ? void 0 : props.components)}/>
      </TestContainerProvider_1.TestContainerProvider>);
                        return [4 /*yield*/, (0, react_1.act)(function () { return Promise.resolve(); })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    }
});
