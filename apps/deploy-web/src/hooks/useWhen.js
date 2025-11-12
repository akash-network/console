"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWhen = useWhen;
var react_1 = require("react");
function useWhen(condition, run, deps) {
    if (deps === void 0) { deps = []; }
    return (0, react_1.useEffect)(function () {
        if (condition) {
            run();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, __spreadArray([condition], deps, true));
}
