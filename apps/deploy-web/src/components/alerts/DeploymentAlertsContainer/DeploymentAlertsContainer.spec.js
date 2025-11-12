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
require("@testing-library/jest-dom");
var react_1 = require("react");
var notifications_1 = require("@akashnetwork/react-query-sdk/notifications");
var context_1 = require("@akashnetwork/ui/context");
var react_query_1 = require("@tanstack/react-query");
var merge_1 = require("lodash/merge");
var DeploymentAlertsContainer_1 = require("@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer");
var denom_config_1 = require("@src/config/denom.config");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var queries_1 = require("@src/queries");
var deploymentDetailUtils_1 = require("@src/utils/deploymentDetailUtils");
var react_2 = require("@testing-library/react");
var deployment_1 = require("@tests/seeders/deployment");
var notificationChannel_1 = require("@tests/seeders/notificationChannel");
var container_testing_child_capturer_1 = require("@tests/unit/container-testing-child-capturer");
describe(DeploymentAlertsContainer_1.DeploymentAlertsContainer.name, function () {
    [
        { denom: denom_config_1.UAKT_DENOM, threshold: 2000000 },
        { denom: denom_config_1.USDC_IBC_DENOMS["mainnet"], threshold: 4000000 }
    ].forEach(function (_a) {
        var denom = _a.denom, threshold = _a.threshold;
        it("triggers ".concat(denom, " deployment alert request with the correct values"), function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, requestFn, input, child, dseq;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, setup({ denom: denom })];
                    case 1:
                        _a = _b.sent(), requestFn = _a.requestFn, input = _a.input, child = _a.child, dseq = _a.dseq;
                        return [4 /*yield*/, (0, react_2.act)(function () { return child.upsert(input); })];
                    case 2:
                        _b.sent();
                        expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({
                            method: "post",
                            url: "/v1/deployment-alerts/{dseq}"
                        }), expect.objectContaining({
                            parameters: {
                                path: { dseq: dseq }
                            },
                            body: {
                                data: (0, merge_1.default)({}, input, {
                                    alerts: {
                                        deploymentBalance: {
                                            threshold: threshold
                                        }
                                    }
                                })
                            }
                        }));
                        return [4 /*yield*/, (0, react_2.waitFor)(function () {
                                expect(react_2.screen.getByTestId("alert-config-success-notification")).toBeInTheDocument();
                            })];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    it("shows error notification on failed request", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, requestFn, input, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), requestFn = _a.requestFn, input = _a.input, child = _a.child;
                    requestFn.mockRejectedValue(new Error("API Error"));
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.upsert(input); })];
                case 2:
                    _b.sent();
                    expect(react_2.screen.queryByTestId("alert-config-error-notification")).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles deployment closed alert configuration", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, requestFn, child, dseq, input;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), requestFn = _a.requestFn, child = _a.child, dseq = _a.dseq;
                    input = {
                        alerts: {
                            deploymentClosed: {
                                enabled: true,
                                notificationChannelId: (0, notificationChannel_1.buildNotificationChannel)().id
                            }
                        }
                    };
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.upsert(input); })];
                case 2:
                    _b.sent();
                    expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({
                        method: "post",
                        url: "/v1/deployment-alerts/{dseq}"
                    }), expect.objectContaining({
                        parameters: {
                            path: { dseq: dseq }
                        },
                        body: {
                            data: input
                        }
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles escrow balance alert configuration", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, requestFn, child, dseq, input;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), requestFn = _a.requestFn, child = _a.child, dseq = _a.dseq;
                    input = {
                        alerts: {
                            deploymentBalance: {
                                enabled: true,
                                threshold: 100,
                                notificationChannelId: (0, notificationChannel_1.buildNotificationChannel)().id
                            }
                        }
                    };
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.upsert(input); })];
                case 2:
                    _b.sent();
                    expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({
                        method: "post",
                        url: "/v1/deployment-alerts/{dseq}"
                    }), expect.objectContaining({
                        parameters: {
                            path: { dseq: dseq }
                        },
                        body: {
                            data: expect.objectContaining({
                                alerts: {
                                    deploymentBalance: expect.objectContaining({
                                        threshold: expect.any(Number)
                                    })
                                }
                            })
                        }
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles both deployment closed and balance alerts", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, requestFn, child, dseq, input;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), requestFn = _a.requestFn, child = _a.child, dseq = _a.dseq;
                    input = {
                        alerts: {
                            deploymentClosed: {
                                enabled: true,
                                notificationChannelId: (0, notificationChannel_1.buildNotificationChannel)().id
                            },
                            deploymentBalance: {
                                enabled: true,
                                threshold: 50,
                                notificationChannelId: (0, notificationChannel_1.buildNotificationChannel)().id
                            }
                        }
                    };
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.upsert(input); })];
                case 2:
                    _b.sent();
                    expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({
                        method: "post",
                        url: "/v1/deployment-alerts/{dseq}"
                    }), expect.objectContaining({
                        parameters: {
                            path: { dseq: dseq }
                        },
                        body: {
                            data: expect.objectContaining({
                                alerts: {
                                    deploymentClosed: expect.objectContaining({
                                        enabled: true
                                    }),
                                    deploymentBalance: expect.objectContaining({
                                        enabled: true,
                                        threshold: expect.any(Number)
                                    })
                                }
                            })
                        }
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    it("provides max balance threshold", function () { return __awaiter(void 0, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.maxBalanceThreshold).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it("invalidates queries on successful mutation", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, requestFn, input, child, invalidateQueriesSpy;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), requestFn = _a.requestFn, input = _a.input, child = _a.child;
                    invalidateQueriesSpy = jest.spyOn(queries_1.queryClient, "invalidateQueries");
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.upsert(input); })];
                case 2:
                    _b.sent();
                    expect(requestFn).toHaveBeenCalled();
                    expect(invalidateQueriesSpy).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, arguments, void 0, function (_a) {
            var rpcDeployment, deployment, dseq, input, requestFn, services, AKT_PRICE, mockPricing, dependencies, childCapturer;
            var _b;
            var _c = _a === void 0 ? {} : _a, denom = _c.denom;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        rpcDeployment = (0, deployment_1.buildRpcDeployment)({ denom: denom });
                        deployment = (0, deploymentDetailUtils_1.deploymentToDto)(rpcDeployment);
                        dseq = deployment.dseq;
                        input = {
                            alerts: {
                                deploymentClosed: {
                                    enabled: true,
                                    notificationChannelId: (0, notificationChannel_1.buildNotificationChannel)().id
                                },
                                deploymentBalance: {
                                    enabled: true,
                                    notificationChannelId: (0, notificationChannel_1.buildNotificationChannel)().id,
                                    threshold: 4
                                }
                            }
                        };
                        requestFn = jest.fn(function () {
                            return Promise.resolve({
                                data: {
                                    dseq: dseq,
                                    alerts: {}
                                }
                            });
                        });
                        services = {
                            notificationsApi: function () {
                                return (0, notifications_1.createAPIClient)({
                                    requestFn: requestFn,
                                    baseUrl: "",
                                    queryClient: queries_1.queryClient
                                });
                            }
                        };
                        AKT_PRICE = 2;
                        mockPricing = {
                            usdToAkt: jest.fn(function (amount) { return amount / AKT_PRICE; }),
                            getPriceForDenom: jest.fn(function (denom) {
                                if (denom === "uakt") {
                                    return AKT_PRICE;
                                }
                                else {
                                    return 1;
                                }
                            })
                        };
                        dependencies = {
                            usePricing: function () { return mockPricing; }
                        };
                        childCapturer = (0, container_testing_child_capturer_1.createContainerTestingChildCapturer)();
                        (0, react_2.render)(<context_1.CustomSnackbarProvider>
        <ServicesProvider_1.ServicesProvider services={services}>
          <react_query_1.QueryClientProvider client={queries_1.queryClient}>
            <DeploymentAlertsContainer_1.DeploymentAlertsContainer deployment={deployment} dependencies={dependencies}>
              {childCapturer.renderChild}
            </DeploymentAlertsContainer_1.DeploymentAlertsContainer>
          </react_query_1.QueryClientProvider>
        </ServicesProvider_1.ServicesProvider>
      </context_1.CustomSnackbarProvider>);
                        _b = { requestFn: requestFn, input: input };
                        return [4 /*yield*/, childCapturer.awaitChild()];
                    case 1: return [2 /*return*/, (_b.child = _d.sent(), _b.dseq = dseq, _b)];
                }
            });
        });
    }
});
