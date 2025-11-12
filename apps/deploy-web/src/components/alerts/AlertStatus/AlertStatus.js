"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertStatus = void 0;
var react_1 = require("react");
var utils_1 = require("@akashnetwork/ui/utils");
var material_1 = require("@mui/material");
var lodash_1 = require("lodash");
var AlertStatus = function (_a) {
    var status = _a.status;
    return (<material_1.Chip label={(0, lodash_1.capitalize)(status)} className={(0, utils_1.cn)(status === "OK" ? "bg-green-300 font-bold text-green-700" : "bg-red-200 font-bold text-red-700", "max-w-48")}/>);
};
exports.AlertStatus = AlertStatus;
