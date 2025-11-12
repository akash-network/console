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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.akashTestnetAssetList = exports.akashTestnet = void 0;
var akash_1 = require("./akash");
exports.akashTestnet = __assign(__assign({}, akash_1.akash), { chain_id: "testnet-7", network_type: "testnet", chain_name: "akash-testnet", pretty_name: "Akash-Testnet", apis: {
        rpc: [{ address: "https://testnetrpc.akashnet.net", provider: "ovrclk" }],
        rest: [{ address: "https://testnetapi.akashnet.net", provider: "ovrclk" }]
    } });
exports.akashTestnetAssetList = __assign(__assign({}, akash_1.akashAssetList), { chain_name: "akash-testnet", assets: __spreadArray([], akash_1.akashAssetList.assets, true) });
