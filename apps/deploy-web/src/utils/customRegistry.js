"use strict";
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
exports.registry = void 0;
var v1 = require("@akashnetwork/chain-sdk/private-types/akash.v1");
var v1beta4 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta4");
var v1beta5 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta5");
var cosmosv1 = require("@akashnetwork/chain-sdk/private-types/cosmos.v1");
var cosmosv1alpha1 = require("@akashnetwork/chain-sdk/private-types/cosmos.v1alpha1");
var cosmosv1beta1 = require("@akashnetwork/chain-sdk/private-types/cosmos.v1beta1");
var cosmosv2alpha1 = require("@akashnetwork/chain-sdk/private-types/cosmos.v2alpha1");
var proto_signing_1 = require("@cosmjs/proto-signing");
var stargate_1 = require("@cosmjs/stargate");
var ibcTypes = stargate_1.defaultRegistryTypes.filter(function (_a) {
    var type = _a[0];
    return type.startsWith("/ibc");
});
var defaultRegistryTypes = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], Object.values(cosmosv1), true), Object.values(cosmosv1beta1), true), Object.values(cosmosv1alpha1), true), Object.values(cosmosv2alpha1), true).filter(function (x) { return x && "$type" in x; })
    .map(function (x) { return ["/" + x.$type, x]; })
    .concat(ibcTypes);
var akashTypes = __spreadArray(__spreadArray(__spreadArray([], Object.values(v1), true), Object.values(v1beta4), true), Object.values(v1beta5), true).filter(function (x) { return x && "$type" in x; })
    .map(function (x) { return ["/" + x.$type, x]; });
exports.registry = new proto_signing_1.Registry(__spreadArray(__spreadArray([], defaultRegistryTypes, true), akashTypes, true));
