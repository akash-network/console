"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nFormatter = nFormatter;
exports.udenomToDenom = udenomToDenom;
exports.denomToUdenom = denomToUdenom;
exports.roundDecimal = roundDecimal;
exports.ceilDecimal = ceilDecimal;
exports.percIncrease = percIncrease;
function nFormatter(num, digits) {
    var lookup = [
        { value: 1, symbol: "" },
        { value: 1e3, symbol: "k" },
        { value: 1e6, symbol: "M" },
        { value: 1e9, symbol: "G" },
        { value: 1e12, symbol: "T" },
        { value: 1e15, symbol: "P" },
        { value: 1e18, symbol: "E" }
    ];
    var rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    var item = lookup
        .slice()
        .reverse()
        .find(function (item) {
        return num >= item.value;
    });
    return item ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : "0";
}
function udenomToDenom(_amount, precision, decimals) {
    if (precision === void 0) { precision = 6; }
    if (decimals === void 0) { decimals = 1000000; }
    var amount = typeof _amount === "string" ? parseFloat(_amount) : _amount;
    return roundDecimal(amount / decimals, precision);
}
function denomToUdenom(amount, decimals) {
    if (decimals === void 0) { decimals = 1000000; }
    return amount * decimals;
}
function roundDecimal(value, precision) {
    if (precision === void 0) { precision = 2; }
    var multiplier = Math.pow(10, precision || 0);
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
function ceilDecimal(value) {
    return Math.ceil((value + Number.EPSILON) * 1000) / 1000;
}
function percIncrease(a, b) {
    var percent;
    if (b !== 0) {
        if (a !== 0) {
            percent = (b - a) / a;
        }
        else {
            percent = b;
        }
    }
    else {
        percent = -a;
    }
    return roundDecimal(percent, 4);
}
