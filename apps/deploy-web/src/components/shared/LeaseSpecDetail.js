"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseSpecDetail = void 0;
var react_1 = require("react");
var md_1 = require("react-icons/md");
var react_intl_1 = require("react-intl");
var utils_1 = require("@akashnetwork/ui/utils");
var LeaseSpecDetail = function (_a) {
    var value = _a.value, type = _a.type, className = _a.className, _b = _a.iconSize, iconSize = _b === void 0 ? "large" : _b;
    return (<div className={(0, utils_1.cn)("flex items-center", className)}>
      <div className="text-muted-foreground">
        {type === "cpu" && <md_1.MdSpeed fontSize={iconSize}/>}
        {type === "gpu" && <md_1.MdDeveloperBoard fontSize={iconSize}/>}
        {type === "ram" && <md_1.MdMemory fontSize={iconSize}/>}
        {type === "storage" && <md_1.MdStorage fontSize={iconSize}/>}
      </div>

      <div className="ml-1">{typeof value === "string" ? value : <react_intl_1.FormattedNumber value={value}/>}</div>
      <div className="ml-1 text-muted-foreground">
        <span className="text-xs text-muted-foreground">
          {type === "cpu" && "CPU"}
          {type === "gpu" && "GPU"}
          {type === "ram" && "RAM"}
          {type === "storage" && "Disk"}
        </span>
      </div>
    </div>);
};
exports.LeaseSpecDetail = LeaseSpecDetail;
