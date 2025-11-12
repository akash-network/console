"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormattedDecimalCurrency = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var FormattedDecimalCurrency = function (_a) {
    var value = _a.value, _b = _a.precision, precision = _b === void 0 ? 6 : _b, style = _a.style, currency = _a.currency;
    return (<react_intl_1.FormattedNumberParts value={value} maximumFractionDigits={precision} minimumFractionDigits={precision} style={style} currency={currency}>
      {function (parts) { return (<div className="inline-flex items-start">
          {parts.map(function (part, i) {
                switch (part.type) {
                    case "currency":
                        return (<span key={i} className="mr-1 self-center text-lg">
                    {part.value}
                  </span>);
                    default:
                        return <react_1.default.Fragment key={i}>{part.value}</react_1.default.Fragment>;
                }
            })}
        </div>); }}
    </react_intl_1.FormattedNumberParts>);
};
exports.FormattedDecimalCurrency = FormattedDecimalCurrency;
