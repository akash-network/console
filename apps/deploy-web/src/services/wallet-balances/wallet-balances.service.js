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
exports.WalletBalancesService = void 0;
var denom_config_1 = require("@src/config/denom.config");
var useDenom_1 = require("@src/hooks/useDenom");
var apiUtils_1 = require("@src/utils/apiUtils");
var deploymentDetailUtils_1 = require("@src/utils/deploymentDetailUtils");
var WalletBalancesService = /** @class */ (function () {
    function WalletBalancesService(authzHttpService, chainApiHttpClient, masterWalletAddress) {
        this.authzHttpService = authzHttpService;
        this.chainApiHttpClient = chainApiHttpClient;
        this.masterWalletAddress = masterWalletAddress;
    }
    WalletBalancesService.prototype.getBalances = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var usdcIbcDenom, _a, balanceResponse, deploymentGrants, activeDeploymentsResponse, deploymentGrantsUAKT, deploymentGrantsUUSDC, balanceData, balanceUAKT, balanceUUSDC, activeDeployments, aktActiveDeployments, usdcActiveDeployments, deploymentEscrowUAKT, deploymentEscrowUUSDC;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        usdcIbcDenom = (0, useDenom_1.getUsdcDenom)();
                        return [4 /*yield*/, Promise.all([
                                this.chainApiHttpClient.get(apiUtils_1.ApiUrlService.balance("", address)),
                                this.authzHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }),
                                (0, apiUtils_1.loadWithPagination)(apiUtils_1.ApiUrlService.deploymentList("", address, true), "deployments", 1000, this.chainApiHttpClient)
                            ])];
                    case 1:
                        _a = _d.sent(), balanceResponse = _a[0], deploymentGrants = _a[1], activeDeploymentsResponse = _a[2];
                        deploymentGrantsUAKT = deploymentGrants
                            .filter(function (grant) { var _a, _b; return ((_b = (_a = grant.authorization) === null || _a === void 0 ? void 0 : _a.spend_limit) === null || _b === void 0 ? void 0 : _b.denom) === denom_config_1.UAKT_DENOM; })
                            .reduce(function (sum, grant) { var _a, _b; return sum + parseFloat(((_b = (_a = grant.authorization) === null || _a === void 0 ? void 0 : _a.spend_limit) === null || _b === void 0 ? void 0 : _b.amount) || "0"); }, 0);
                        deploymentGrantsUUSDC = deploymentGrants
                            .filter(function (grant) { var _a, _b; return ((_b = (_a = grant.authorization) === null || _a === void 0 ? void 0 : _a.spend_limit) === null || _b === void 0 ? void 0 : _b.denom) === usdcIbcDenom; })
                            .reduce(function (sum, grant) { var _a, _b; return sum + parseFloat(((_b = (_a = grant.authorization) === null || _a === void 0 ? void 0 : _a.spend_limit) === null || _b === void 0 ? void 0 : _b.amount) || "0"); }, 0);
                        balanceData = balanceResponse.data;
                        balanceUAKT = balanceData.balances.some(function (b) { return b.denom === denom_config_1.UAKT_DENOM; }) || deploymentGrantsUAKT > 0
                            ? parseFloat(((_b = balanceData.balances.find(function (b) { return b.denom === denom_config_1.UAKT_DENOM; })) === null || _b === void 0 ? void 0 : _b.amount) || "0")
                            : 0;
                        balanceUUSDC = balanceData.balances.some(function (b) { return b.denom === usdcIbcDenom; }) || deploymentGrantsUUSDC > 0
                            ? parseFloat(((_c = balanceData.balances.find(function (b) { return b.denom === usdcIbcDenom; })) === null || _c === void 0 ? void 0 : _c.amount) || "0")
                            : 0;
                        activeDeployments = activeDeploymentsResponse.map(function (d) { return (0, deploymentDetailUtils_1.deploymentToDto)(d); });
                        aktActiveDeployments = activeDeployments.filter(function (d) { return d.denom === denom_config_1.UAKT_DENOM; });
                        usdcActiveDeployments = activeDeployments.filter(function (d) { return d.denom === usdcIbcDenom; });
                        deploymentEscrowUAKT = aktActiveDeployments.reduce(function (acc, d) { return acc + d.escrowBalance; }, 0);
                        deploymentEscrowUUSDC = usdcActiveDeployments.reduce(function (acc, d) { return acc + d.escrowBalance; }, 0);
                        return [2 /*return*/, {
                                balanceUAKT: balanceUAKT,
                                balanceUUSDC: balanceUUSDC,
                                deploymentEscrowUAKT: deploymentEscrowUAKT,
                                deploymentEscrowUUSDC: deploymentEscrowUUSDC,
                                deploymentGrantsUAKT: deploymentGrantsUAKT,
                                deploymentGrantsUUSDC: deploymentGrantsUUSDC,
                                activeDeployments: activeDeployments,
                                deploymentGrants: deploymentGrants
                            }];
                }
            });
        });
    };
    return WalletBalancesService;
}());
exports.WalletBalancesService = WalletBalancesService;
