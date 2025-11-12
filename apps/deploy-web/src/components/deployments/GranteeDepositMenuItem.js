"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GranteeDepositMenuItem = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var priceUtils_1 = require("@src/utils/priceUtils");
var AKTAmount_1 = require("../shared/AKTAmount");
var GranteeDepositMenuItem = function (_a) {
    var grant = _a.grant;
    var denomData = (0, useWalletBalance_1.useDenomData)(grant.authorization.spend_limit.denom);
    return (<div className="text-xs">
      <components_1.Address address={grant.granter} disableTooltip/>
      &nbsp;<small className="text-muted-foreground">|</small>&nbsp;
      <AKTAmount_1.AKTAmount uakt={(0, priceUtils_1.coinToUDenom)(grant.authorization.spend_limit)}/>
      &nbsp;
      {denomData === null || denomData === void 0 ? void 0 : denomData.label}
      &nbsp;
      <small className="text-muted-foreground">
        (Exp:&nbsp;
        <react_intl_1.FormattedDate value={new Date(grant.expiration)}/>)
      </small>
    </div>);
};
exports.GranteeDepositMenuItem = GranteeDepositMenuItem;
