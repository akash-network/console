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
exports.ApiUrlService = void 0;
exports.loadWithPagination = loadWithPagination;
var browser_di_container_1 = require("@src/services/app-di-container/browser-di-container");
var networkStore_1 = require("@src/store/networkStore");
var urlUtils_1 = require("./urlUtils");
var ApiUrlService = /** @class */ (function () {
    function ApiUrlService() {
    }
    ApiUrlService.depositParams = function (apiEndpoint) {
        return "".concat(apiEndpoint, "/cosmos/params/v1beta1/params?subspace=deployment&key=MinDeposits");
    };
    ApiUrlService.certificatesList = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/akash/cert/").concat(networkStore_1.default.certVersion, "/certificates/list?filter.state=valid&filter.owner=").concat(address);
    };
    ApiUrlService.deploymentList = function (apiEndpoint, address, isActive) {
        return "".concat(apiEndpoint, "/akash/deployment/").concat(networkStore_1.default.deploymentVersion, "/deployments/list?filters.owner=").concat(address).concat(isActive ? "&filters.state=active" : "");
    };
    ApiUrlService.deploymentDetail = function (apiEndpoint, address, dseq) {
        return "".concat(apiEndpoint, "/akash/deployment/").concat(networkStore_1.default.deploymentVersion, "/deployments/info?id.owner=").concat(address, "&id.dseq=").concat(dseq);
    };
    ApiUrlService.bidList = function (apiEndpoint, address, dseq) {
        return "".concat(apiEndpoint, "/akash/market/").concat(networkStore_1.default.marketVersion, "/bids/list?filters.owner=").concat(address, "&filters.dseq=").concat(dseq);
    };
    ApiUrlService.bidInfo = function (apiEndpoint, address, dseq, gseq, oseq, provider) {
        return "".concat(apiEndpoint, "/akash/market/").concat(networkStore_1.default.marketVersion, "/bids/info?id.owner=").concat(address, "&id.dseq=").concat(dseq, "&id.gseq=").concat(gseq, "&id.oseq=").concat(oseq, "&id.provider=").concat(provider);
    };
    ApiUrlService.leaseList = function (apiEndpoint, address, dseq) {
        return "".concat(apiEndpoint, "/akash/market/").concat(networkStore_1.default.marketVersion, "/leases/list?filters.owner=").concat(address).concat(dseq ? "&filters.dseq=" + dseq : "");
    };
    ApiUrlService.providers = function (apiEndpoint) {
        return "".concat(apiEndpoint, "/akash/provider/").concat(networkStore_1.default.providerVersion, "/providers");
    };
    ApiUrlService.providerList = function () {
        return "".concat(this.baseApiUrl, "/v1/providers");
    };
    ApiUrlService.providerDetail = function (owner) {
        return "".concat(this.baseApiUrl, "/v1/providers/").concat(owner);
    };
    ApiUrlService.providerRegions = function () {
        return "".concat(this.baseApiUrl, "/v1/provider-regions");
    };
    ApiUrlService.block = function (apiEndpoint, id) {
        return "".concat(apiEndpoint, "/cosmos/base/tendermint/v1beta1/blocks/").concat(id);
    };
    ApiUrlService.balance = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/bank/v1beta1/balances/").concat(address);
    };
    ApiUrlService.rewards = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/distribution/v1beta1/delegators/").concat(address, "/rewards");
    };
    ApiUrlService.redelegations = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/staking/v1beta1/delegators/").concat(address, "/redelegations");
    };
    ApiUrlService.delegations = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/staking/v1beta1/delegations/").concat(address);
    };
    ApiUrlService.unbonding = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/staking/v1beta1/delegators/").concat(address, "/unbonding_delegations");
    };
    ApiUrlService.granterGrants = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/authz/v1beta1/grants/granter/").concat(address);
    };
    ApiUrlService.allowancesIssued = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/feegrant/v1beta1/issued/").concat(address);
    };
    ApiUrlService.allowancesGranted = function (apiEndpoint, address) {
        return "".concat(apiEndpoint, "/cosmos/feegrant/v1beta1/allowances/").concat(address);
    };
    ApiUrlService.dashboardData = function () {
        return "".concat(this.baseApiUrl, "/v1/dashboard-data");
    };
    ApiUrlService.marketData = function () {
        return "".concat(this.baseApiUrl, "/v1/market-data");
    };
    ApiUrlService.proposals = function () {
        return "".concat(this.baseApiUrl, "/v1/proposals");
    };
    ApiUrlService.apiProviders = function () {
        return "".concat(this.baseApiUrl, "/v1/providers");
    };
    ApiUrlService.templates = function () {
        return "".concat(this.baseApiUrl, "/v1/templates");
    };
    ApiUrlService.usage = function () {
        return "".concat(this.baseApiUrl, "/v1/usage/history");
    };
    ApiUrlService.usageStats = function () {
        return "".concat(this.baseApiUrl, "/v1/usage/history/stats");
    };
    ApiUrlService.validators = function () {
        return "".concat(this.baseApiUrl, "/v1/validators");
    };
    ApiUrlService.transactions = function (limit) {
        return "".concat(this.baseApiUrl, "/v1/transactions").concat((0, urlUtils_1.appendSearchParams)({ limit: limit }));
    };
    ApiUrlService.addressTransactions = function (address, skip, limit) {
        return "".concat(this.baseApiUrl, "/v1/addresses/").concat(address, "/transactions/").concat(skip, "/").concat(limit);
    };
    ApiUrlService.addressDeployments = function (address, skip, limit, reverseSorting, filters) {
        return "".concat(this.baseApiUrl, "/v1/addresses/").concat(address, "/deployments/").concat(skip, "/").concat(limit).concat((0, urlUtils_1.appendSearchParams)(__assign({ reverseSorting: reverseSorting }, filters)));
    };
    ApiUrlService.graphData = function (snapshot) {
        return "".concat(this.baseApiUrl, "/v1/graph-data/").concat(snapshot);
    };
    ApiUrlService.providerGraphData = function (snapshot) {
        return "".concat(this.baseApiUrl, "/v1/provider-graph-data/").concat(snapshot);
    };
    ApiUrlService.blocks = function (limit) {
        return "".concat(this.baseApiUrl, "/v1/blocks").concat((0, urlUtils_1.appendSearchParams)({ limit: limit }));
    };
    ApiUrlService.providerActiveLeasesGraph = function (providerAddress) {
        return "".concat(this.baseApiUrl, "/v1/providers/").concat(providerAddress, "/active-leases-graph-data");
    };
    ApiUrlService.providerAttributesSchema = function () {
        return "".concat(this.baseApiUrl, "/v1/provider-attributes-schema");
    };
    ApiUrlService.networkCapacity = function () {
        return "".concat(this.baseApiUrl, "/v1/network-capacity");
    };
    ApiUrlService.gpuModels = function () {
        return "".concat(this.baseApiUrl, "/v1/gpu-models");
    };
    ApiUrlService.auditors = function () {
        return "".concat(this.baseApiUrl, "/v1/auditors");
    };
    ApiUrlService.trialProviders = function () {
        return "".concat(this.baseApiUrl, "/v1/trial-providers");
    };
    Object.defineProperty(ApiUrlService, "baseApiUrl", {
        get: function () {
            return browser_di_container_1.services.apiUrlService.getBaseApiUrlFor(networkStore_1.default.selectedNetworkId);
        },
        enumerable: false,
        configurable: true
    });
    return ApiUrlService;
}());
exports.ApiUrlService = ApiUrlService;
/**
 * @deprecated use getAllItems utility from @akashnetwork/http-sdk
 * TODO: implement proper pagination on clients
 * Issue: https://github.com/akash-network/console/milestone/7
 */
function loadWithPagination(baseUrl, dataKey, limit, httpClient) {
    return __awaiter(this, void 0, void 0, function () {
        var items, nextKey, _hasQueryParam, queryUrl, response, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    items = [];
                    nextKey = null;
                    _a.label = 1;
                case 1:
                    _hasQueryParam = hasQueryParam(baseUrl);
                    queryUrl = "".concat(baseUrl).concat(_hasQueryParam ? "&" : "?", "pagination.limit=").concat(limit, "&pagination.count_total=true");
                    if (nextKey) {
                        queryUrl += "&pagination.key=" + encodeURIComponent(nextKey);
                    }
                    return [4 /*yield*/, httpClient.get(queryUrl)];
                case 2:
                    response = _a.sent();
                    data = response.data;
                    // if (!nextKey) {
                    //   totalCount = data.pagination.total;
                    // }
                    items = items.concat(data[dataKey]);
                    nextKey = data.pagination.next_key;
                    _a.label = 3;
                case 3:
                    if (nextKey) return [3 /*break*/, 1];
                    _a.label = 4;
                case 4: return [2 /*return*/, items.filter(function (item) { return item; })];
            }
        });
    });
}
function hasQueryParam(url) {
    return /[?&]/gm.test(url);
}
