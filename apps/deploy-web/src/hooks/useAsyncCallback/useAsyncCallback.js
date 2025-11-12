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
exports.useAsyncCallback = useAsyncCallback;
var react_1 = require("react");
function useAsyncCallback(fn, deps) {
    if (deps === void 0) { deps = []; }
    var _a = (0, react_1.useState)(null), data = _a[0], setData = _a[1];
    var _b = (0, react_1.useState)(null), error = _b[0], setError = _b[1];
    var _c = (0, react_1.useState)(null), inflightPromise = _c[0], setInflightPromise = _c[1];
    var invoke = (0, react_1.useCallback)(function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (inflightPromise)
            return inflightPromise;
        var promise = fn.apply(void 0, args).then(function (result) {
            setData(result);
            return result;
        })
            .catch(setError)
            .finally(function () { return setInflightPromise(null); });
        setInflightPromise(promise);
        return promise;
    }, __spreadArray([fn, inflightPromise], deps, true));
    return [invoke, { data: data, error: error, isPending: !!inflightPromise }];
}
