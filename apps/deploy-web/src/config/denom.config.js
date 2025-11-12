"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.READABLE_DENOMS = exports.USDC_IBC_DENOMS = exports.UAKT_DENOM = void 0;
var web_1 = require("@akashnetwork/chain-sdk/web");
exports.UAKT_DENOM = "uakt";
exports.USDC_IBC_DENOMS = (_a = {},
    _a[web_1.MAINNET_ID] = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
    _a[web_1.SANDBOX_ID] = "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84",
    _a[web_1.TESTNET_ID] = "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84",
    _a);
var READABLE_AKT_DENOM = "uAKT";
var READABLE_USDC_DENOM = "uUSDC";
exports.READABLE_DENOMS = (_b = {},
    _b[exports.UAKT_DENOM] = READABLE_AKT_DENOM,
    _b[exports.USDC_IBC_DENOMS[web_1.MAINNET_ID]] = READABLE_USDC_DENOM,
    _b[exports.USDC_IBC_DENOMS[web_1.SANDBOX_ID]] = READABLE_USDC_DENOM,
    _b[exports.USDC_IBC_DENOMS[web_1.TESTNET_ID]] = READABLE_USDC_DENOM,
    _b);
