"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GranteeRow = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var AKTAmount_1 = require("@src/components/shared/AKTAmount");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var priceUtils_1 = require("@src/utils/priceUtils");
var GranteeRow = function (_a) {
    var _b;
    var grant = _a.grant;
    var limit = (_b = grant === null || grant === void 0 ? void 0 : grant.authorization) === null || _b === void 0 ? void 0 : _b.spend_limit;
    var denomData = (0, useWalletBalance_1.useDenomData)(limit === null || limit === void 0 ? void 0 : limit.denom);
    return (<components_1.TableRow className="[&>td]:px-2 [&>td]:py-1">
      <components_1.TableCell>
        <components_1.Address address={grant.granter} isCopyable/>
      </components_1.TableCell>
      <components_1.TableCell align="right">
        {limit ? (<>
            <AKTAmount_1.AKTAmount uakt={(0, priceUtils_1.coinToUDenom)(limit)}/> {denomData === null || denomData === void 0 ? void 0 : denomData.label}
          </>) : (<span>Unlimited</span>)}
      </components_1.TableCell>
      <components_1.TableCell align="right">
        <react_intl_1.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration}/>
      </components_1.TableCell>
    </components_1.TableRow>);
};
exports.GranteeRow = GranteeRow;
