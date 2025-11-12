"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AKTAmount = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var PricingProvider_1 = require("@src/context/PricingProvider");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var AKTLabel_1 = require("./AKTLabel");
var AKTAmount = function (_a) {
    var uakt = _a.uakt, showUSD = _a.showUSD, showAKTLabel = _a.showAKTLabel, _b = _a.digits, digits = _b === void 0 ? 6 : _b, notation = _a.notation;
    var _c = (0, PricingProvider_1.usePricing)(), isPriceLoaded = _c.isLoaded, aktToUSD = _c.aktToUSD;
    var aktAmount = (0, mathHelpers_1.udenomToDenom)(uakt, 6);
    return (<>
      <react_intl_1.FormattedNumberParts value={aktAmount} maximumFractionDigits={digits} minimumFractionDigits={digits} notation={notation}>
        {function (parts) { return (<>
            {parts.map(function (part, i) {
                switch (part.type) {
                    case "integer":
                    case "group":
                        return <b key={i}>{part.value}</b>;
                    case "decimal":
                    case "fraction":
                        return (<small key={i} className="text-secondary-foreground">
                      {part.value}
                    </small>);
                    default:
                        return <react_1.default.Fragment key={i}>{part.value}</react_1.default.Fragment>;
                }
            })}
          </>); }}
      </react_intl_1.FormattedNumberParts>
      {showAKTLabel && <AKTLabel_1.AKTLabel />}
      {isPriceLoaded && showUSD && aktAmount > 0 && (<small className="text-secondary-foreground">
          &nbsp;(
          <react_intl_1.FormattedNumber style="currency" currency="USD" value={aktToUSD(aktAmount) || 0} notation="compact"/>)
        </small>)}
    </>);
};
exports.AKTAmount = AKTAmount;
