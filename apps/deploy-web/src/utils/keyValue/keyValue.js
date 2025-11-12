"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kvArrayToObject = kvArrayToObject;
exports.objectToKvArray = objectToKvArray;
function kvArrayToObject(arr) {
    if (arr === void 0) { arr = []; }
    return arr.reduce(function (acc, _a) {
        var key = _a.key, value = _a.value;
        acc[key] = value;
        return acc;
    }, {});
}
function objectToKvArray(obj) {
    return Object.entries(obj).map(function (_a) {
        var key = _a[0], value = _a[1];
        return ({
            key: key,
            value: value
        });
    });
}
