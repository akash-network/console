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
exports.mapToBidDto = mapToBidDto;
exports.useBidList = useBidList;
exports.useBidInfo = useBidInfo;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var apiUtils_1 = require("@src/utils/apiUtils");
var queryKeys_1 = require("./queryKeys");
function getBidList(apiClient, address, dseq) {
    return __awaiter(this, void 0, void 0, function () {
        var response, bids;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!address || !dseq)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, apiClient.get(apiUtils_1.ApiUrlService.bidList("", address, dseq))];
                case 1:
                    response = _a.sent();
                    bids = response.data.bids;
                    return [2 /*return*/, bids.map(mapToBidDto)];
            }
        });
    });
}
function mapToBidDto(b) {
    return {
        id: b.bid.id.provider + b.bid.id.dseq + b.bid.id.gseq + b.bid.id.oseq,
        owner: b.bid.id.owner,
        provider: b.bid.id.provider,
        dseq: b.bid.id.dseq,
        gseq: b.bid.id.gseq,
        oseq: b.bid.id.oseq,
        price: b.bid.price,
        state: b.bid.state,
        resourcesOffer: b.bid.resources_offer
    };
}
function useBidList(address, dseq, options) {
    var chainApiHttpClient = (0, ServicesProvider_1.useServices)().chainApiHttpClient;
    return (0, react_query_1.useQuery)(__assign(__assign({ queryKey: queryKeys_1.QueryKeys.getBidListKey(address, dseq), queryFn: function () { return getBidList(chainApiHttpClient, address, dseq); } }, options), { enabled: (options === null || options === void 0 ? void 0 : options.enabled) !== false && !chainApiHttpClient.isFallbackEnabled }));
}
function getBidInfo(apiClient, address, dseq, gseq, oseq, provider) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!address || !dseq || !gseq || !oseq || !provider)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, apiClient.get(apiUtils_1.ApiUrlService.bidInfo("", address, dseq, gseq, oseq, provider))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
function useBidInfo(address, dseq, gseq, oseq, provider, options) {
    var chainApiHttpClient = (0, ServicesProvider_1.useServices)().chainApiHttpClient;
    return (0, react_query_1.useQuery)(__assign(__assign({ queryKey: queryKeys_1.QueryKeys.getBidInfoKey(address, dseq, gseq, oseq, provider), queryFn: function () { return getBidInfo(chainApiHttpClient, address, dseq, gseq, oseq, provider); } }, options), { enabled: (options === null || options === void 0 ? void 0 : options.enabled) !== false && !chainApiHttpClient.isFallbackEnabled }));
}
