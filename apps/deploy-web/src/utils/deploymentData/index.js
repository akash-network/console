"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentData = void 0;
var web_1 = require("@akashnetwork/chain-sdk/web");
var networkStore_1 = require("@src/store/networkStore");
var v1beta3 = require("./v1beta3");
__exportStar(require("./helpers"), exports);
var NETWORK_SDL = (_a = {},
    _a[web_1.MAINNET_ID] = v1beta3,
    _a[web_1.TESTNET_ID] = v1beta3,
    _a[web_1.SANDBOX_ID] = v1beta3,
    _a);
exports.deploymentData = NETWORK_SDL[networkStore_1.default.selectedNetworkId];
