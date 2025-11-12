"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Uptime = void 0;
var react_intl_1 = require("react-intl");
var utils_1 = require("@akashnetwork/ui/utils");
var Uptime = function (_a) {
    var _b;
    var value = _a.value;
    var intl = (0, react_intl_1.useIntl)();
    return (<span className={(0, utils_1.cn)((_b = {}, _b["text-green-600"] = value > 0.95, _b["text-orange-600"] = value < 0.95, _b))}>
      {intl.formatNumber(value, { style: "percent", maximumFractionDigits: 2 })}
    </span>);
};
exports.Uptime = Uptime;
