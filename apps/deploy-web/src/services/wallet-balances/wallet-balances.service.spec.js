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
var denom_config_1 = require("@src/config/denom.config");
var deploymentDetailUtils_1 = require("@src/utils/deploymentDetailUtils");
var wallet_balances_service_1 = require("./wallet-balances.service");
var deployment_1 = require("@tests/seeders/deployment");
describe(wallet_balances_service_1.WalletBalancesService.name, function () {
    var walletAddress = "akash1qh0f0h7jlq4x5gpxghrxvps5l09y7uuvcumcab";
    describe("getBalances", function () {
        it("returns balances", function () { return __awaiter(void 0, void 0, void 0, function () {
            var deployments, service, balances;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        deployments = [
                            (0, deployment_1.buildRpcDeployment)({
                                deployment: {
                                    id: {
                                        dseq: "666922",
                                        owner: walletAddress
                                    },
                                    state: "open"
                                }
                            }),
                            (0, deployment_1.buildRpcDeployment)({
                                deployment: {
                                    id: {
                                        dseq: "666923",
                                        owner: walletAddress
                                    },
                                    state: "open"
                                }
                            })
                        ];
                        service = setup({
                            getAllDepositDeploymentGrants: function () { return Promise.resolve([]); },
                            getDeploymentList: function () { return deployments; }
                        });
                        return [4 /*yield*/, service.getBalances(walletAddress)];
                    case 1:
                        balances = _a.sent();
                        expect(balances).toEqual({
                            balanceUAKT: 73477804,
                            balanceUUSDC: 0,
                            deploymentEscrowUAKT: 0.8768,
                            deploymentEscrowUUSDC: 0,
                            deploymentGrants: [],
                            deploymentGrantsUAKT: 0,
                            deploymentGrantsUUSDC: 0,
                            activeDeployments: deployments.map(function (d) { return (0, deploymentDetailUtils_1.deploymentToDto)(d); })
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(input) {
        return new wallet_balances_service_1.WalletBalancesService((0, jest_mock_extended_1.mock)({
            getAllDepositDeploymentGrants: input.getAllDepositDeploymentGrants
        }), (0, jest_mock_extended_1.mock)({
            get: function (url) {
                return __awaiter(this, void 0, void 0, function () {
                    var _a, _b;
                    return __generator(this, function (_c) {
                        if (url.includes("deployments/list")) {
                            return [2 /*return*/, Promise.resolve({
                                    data: {
                                        deployments: ((_a = input.getDeploymentList) === null || _a === void 0 ? void 0 : _a.call(input)) || [
                                            (0, deployment_1.buildRpcDeployment)({
                                                deployment: {
                                                    id: {
                                                        dseq: "666922",
                                                        owner: walletAddress
                                                    },
                                                    state: "open"
                                                }
                                            }),
                                            (0, deployment_1.buildRpcDeployment)({
                                                deployment: {
                                                    id: {
                                                        dseq: "666923",
                                                        owner: walletAddress
                                                    },
                                                    state: "open"
                                                }
                                            })
                                        ],
                                        pagination: {
                                            next_key: null,
                                            total: "2"
                                        }
                                    }
                                })];
                        }
                        if (url.includes("cosmos/bank/v1beta1/balances")) {
                            return [2 /*return*/, Promise.resolve({
                                    data: ((_b = input.getBalances) === null || _b === void 0 ? void 0 : _b.call(input)) || {
                                        balances: [
                                            { denom: denom_config_1.USDC_IBC_DENOMS.sandbox, amount: "49944457" },
                                            { denom: denom_config_1.UAKT_DENOM, amount: "73477804" }
                                        ]
                                    }
                                })];
                        }
                        return [2 /*return*/, Promise.reject(new Error("Not implemented"))];
                    });
                });
            }
        }), input.masterWalletAddress || "akash1234");
    }
});
