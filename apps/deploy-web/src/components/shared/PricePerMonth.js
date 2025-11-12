"use strict";
"use client";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricePerMonth = void 0;
var dateUtils_1 = require("@src/utils/dateUtils");
var priceUtils_1 = require("@src/utils/priceUtils");
var PriceValue_1 = require("./PriceValue");
var PricePerMonth = function (_a) {
    var perBlockValue = _a.perBlockValue, denom = _a.denom, className = _a.className, rest = __rest(_a, ["perBlockValue", "denom", "className"]);
    var value = perBlockValue * (60 / priceUtils_1.averageBlockTime) * 60 * 24 * dateUtils_1.averageDaysInMonth;
    return (<span className={className} {...rest}>
      <strong>
        <PriceValue_1.PriceValue value={value} denom={denom}/>
      </strong>{" "}
      / month
    </span>);
};
exports.PricePerMonth = PricePerMonth;
