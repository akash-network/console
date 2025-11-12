"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useTailwind;
var react_1 = require("react");
var resolveConfig_1 = require("tailwindcss/resolveConfig");
var tailwind_config_1 = require("../../tailwind.config");
function useTailwind() {
    var tailwind = (0, react_1.useMemo)(function () { return (0, resolveConfig_1.default)(tailwind_config_1.default); }, [tailwind_config_1.default]);
    return tailwind;
}
