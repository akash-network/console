"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceEstimateTooltip = void 0;
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var dateUtils_1 = require("@src/utils/dateUtils");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var PriceValue_1 = require("./PriceValue");
var PriceEstimateTooltip = function (_a) {
    var value = _a.value, denom = _a.denom;
    var _value = (0, mathHelpers_1.udenomToDenom)(typeof value === "string" ? parseFloat(value) : value, 10);
    var perDayValue = _value * (60 / priceUtils_1.averageBlockTime) * 60 * 24;
    var perMonthValue = _value * (60 / priceUtils_1.averageBlockTime) * 60 * 24 * dateUtils_1.averageDaysInMonth;
    var denomData = (0, useWalletBalance_1.useDenomData)(denom);
    var isCustodial = (0, WalletProvider_1.useWallet)().isCustodial;
    return (<components_1.CustomTooltip title={<div>
          <span className="text-sm text-muted-foreground">Price estimation:</span>
          <div>
            <strong>
              <PriceValue_1.PriceValue value={_value} denom={denom}/>
            </strong>
            &nbsp; per block (~{priceUtils_1.averageBlockTime}sec.)
          </div>

          <div>
            <strong>
              <PriceValue_1.PriceValue value={perDayValue} denom={denom}/>
            </strong>
            &nbsp; per day
          </div>

          <div>
            <strong>
              <PriceValue_1.PriceValue value={perMonthValue} denom={denom}/>
            </strong>
            &nbsp; per month
          </div>

          {isCustodial && <div className="mt-2 text-xs">({"~".concat((0, mathHelpers_1.udenomToDenom)((0, priceUtils_1.getAvgCostPerMonth)(value)), " ").concat(denomData === null || denomData === void 0 ? void 0 : denomData.label, "/month")})</div>}
        </div>}>
      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
    </components_1.CustomTooltip>);
};
exports.PriceEstimateTooltip = PriceEstimateTooltip;
