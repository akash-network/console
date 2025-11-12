"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowanceTitleByType = void 0;
var cosmos_v1beta1_1 = require("@akashnetwork/chain-sdk/private-types/cosmos.v1beta1");
var getAllowanceTitleByType = function (allowance) {
    switch (allowance.allowance["@type"]) {
        case "/".concat(cosmos_v1beta1_1.BasicAllowance.$type):
            return "Basic";
        case "/".concat(cosmos_v1beta1_1.PeriodicAllowance.$type):
            return "Periodic";
        case "$CONNECTED_WALLET":
            return "Connected Wallet";
        default:
            return "Unknown";
    }
};
exports.getAllowanceTitleByType = getAllowanceTitleByType;
