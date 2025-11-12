"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fieldset = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var Fieldset = function (_a) {
    var label = _a.label, subLabel = _a.subLabel, _b = _a.className, className = _b === void 0 ? "" : _b, children = _a.children;
    return (<components_1.Card className={className}>
      <components_1.CardHeader>
        {label}
        {subLabel && <p className="text-gray-400">{subLabel}</p>}
      </components_1.CardHeader>

      <components_1.CardContent className="relative rounded-sm">{children}</components_1.CardContent>
    </components_1.Card>);
};
exports.Fieldset = Fieldset;
