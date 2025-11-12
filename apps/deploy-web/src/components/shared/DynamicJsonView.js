"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicReactJson = void 0;
var components_1 = require("@akashnetwork/ui/components");
var dynamic_1 = require("next/dynamic");
var next_themes_1 = require("next-themes");
var _DynamicReactJson = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("@textea/json-viewer"); }).then(function (module) { return module.JsonViewer; }); }, {
    ssr: false,
    loading: function () { return (<div className="flex items-center text-sm text-muted-foreground">
      Loading... <components_1.Spinner size="small" className="ml-2"/>
    </div>); }
});
var DynamicReactJson = function (_a) {
    var src = _a.src, _b = _a.collapsed, collapsed = _b === void 0 ? 5 : _b;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    return <_DynamicReactJson value={src} theme={resolvedTheme === "dark" ? "dark" : "light"} defaultInspectDepth={collapsed}/>;
};
exports.DynamicReactJson = DynamicReactJson;
