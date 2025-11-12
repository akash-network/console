"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiUrlService = void 0;
var web_1 = require("@akashnetwork/chain-sdk/web");
var ApiUrlService = /** @class */ (function () {
    function ApiUrlService(config) {
        this.config = config;
    }
    ApiUrlService.prototype.getBaseApiUrlFor = function (network) {
        if ("BASE_API_MAINNET_URL" in this.config) {
            switch (network) {
                case web_1.TESTNET_ID:
                    return this.config.BASE_API_TESTNET_URL;
                case web_1.SANDBOX_ID:
                    return this.config.BASE_API_SANDBOX_URL;
                default:
                    return this.config.BASE_API_MAINNET_URL;
            }
        }
        switch (network) {
            case web_1.TESTNET_ID:
                return this.config.NEXT_PUBLIC_BASE_API_TESTNET_URL;
            case web_1.SANDBOX_ID:
                return this.config.NEXT_PUBLIC_BASE_API_SANDBOX_URL;
            default:
                return this.config.NEXT_PUBLIC_BASE_API_MAINNET_URL;
        }
    };
    return ApiUrlService;
}());
exports.ApiUrlService = ApiUrlService;
