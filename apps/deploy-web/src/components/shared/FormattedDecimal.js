"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormattedDecimal = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var FormattedDecimal = function (_a) {
    var value = _a.value, _b = _a.precision, precision = _b === void 0 ? 6 : _b, style = _a.style, currency = _a.currency;
    return (<react_intl_1.FormattedNumberParts value={value} maximumFractionDigits={precision} minimumFractionDigits={precision} style={style} currency={currency}>
      {function (parts) { return (<>
          {parts.map(function (part, i) {
                switch (part.type) {
                    case "integer":
                    case "group":
                        return <b key={i}>{part.value}</b>;
                    case "decimal":
                    case "fraction":
                        return (<small key={i} className="text-xs">
                    {part.value}
                  </small>);
                    default:
                        return <react_1.default.Fragment key={i}>{part.value}</react_1.default.Fragment>;
                }
            })}
        </>); }}
    </react_intl_1.FormattedNumberParts>);
};
exports.FormattedDecimal = FormattedDecimal;
