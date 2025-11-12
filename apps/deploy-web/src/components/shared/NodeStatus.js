"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeStatus = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var StatusPill_1 = require("./StatusPill");
var NodeStatus = function (_a) {
    var _b;
    var latency = _a.latency, status = _a.status, _c = _a.variant, variant = _c === void 0 ? "regular" : _c;
    return (<div className="flex items-center">
      <div>
        <span className={(0, utils_1.cn)("text-muted-foreground", (_b = {}, _b["text-sm"] = variant === "regular", _b["text-xs"] = variant === "dense", _b))}>
          {latency}ms{latency >= 10000 && "+"}
        </span>
      </div>
      <div>
        <StatusPill_1.StatusPill state={status === "active" ? "active" : "closed"} size={variant === "regular" ? "medium" : "small"}/>
      </div>
    </div>);
};
exports.NodeStatus = NodeStatus;
