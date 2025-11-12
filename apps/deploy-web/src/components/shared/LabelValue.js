"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelValue = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var LabelValue = function (_a) {
    var label = _a.label, value = _a.value, _b = _a.labelWidth, labelWidth = _b === void 0 ? "15rem" : _b, _c = _a.className, className = _c === void 0 ? "" : _c;
    return (<div className={(0, utils_1.cn)(className, "mb-4 flex flex-col items-start last:mb-0 sm:flex-row sm:items-center")}>
      {label && (<div className="flex shrink-0 items-center break-all pr-2 font-bold text-muted-foreground" style={{ width: labelWidth }}>
          {label}
        </div>)}
      {value !== undefined && <div className="w-full flex-grow break-all [overflow-wrap:anywhere] sm:w-auto">{value}</div>}
    </div>);
};
exports.LabelValue = LabelValue;
