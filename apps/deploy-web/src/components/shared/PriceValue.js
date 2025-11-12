"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceValue = void 0;
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var PricingProvider_1 = require("@src/context/PricingProvider");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var PriceValue = function (_a) {
    var denom = _a.denom, value = _a.value, showLt = _a.showLt, className = _a.className;
    var _b = (0, PricingProvider_1.usePricing)(), isLoaded = _b.isLoaded, getPriceForDenom = _b.getPriceForDenom;
    var price = getPriceForDenom(denom);
    var _value = (typeof value === "string" ? parseFloat(value) : value) * price;
    var computedValue = _value > 0 ? (0, mathHelpers_1.ceilDecimal)(_value) : 0;
    return (<span className={(0, utils_1.cn)("inline-flex items-center", className)}>
      {!isLoaded && <components_1.Spinner size="small"/>}
      {showLt && !!price && _value !== computedValue && "< "}
      {!!price && (<react_intl_1.FormattedNumber value={computedValue} 
        // eslint-disable-next-line react/style-prop-object
        style="currency" currency="USD"/>)}
    </span>);
};
exports.PriceValue = PriceValue;
