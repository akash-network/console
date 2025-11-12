"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAutoTopUpService = void 0;
var react_1 = require("react");
var denom_config_1 = require("@src/config/denom.config");
var auto_top_up_message_service_1 = require("@src/services/auto-top-up-message/auto-top-up-message.service");
var networkStore_1 = require("@src/store/networkStore");
var useAutoTopUpService = function () {
    var selectedNetworkId = networkStore_1.default.useSelectedNetworkId();
    // BUGALERT: there is no testnet network in USDC_IBC_DENOMS
    var usdcDenom = denom_config_1.USDC_IBC_DENOMS[selectedNetworkId];
    return (0, react_1.useMemo)(function () { return new auto_top_up_message_service_1.AutoTopUpMessageService(usdcDenom); }, [usdcDenom]);
};
exports.useAutoTopUpService = useAutoTopUpService;
