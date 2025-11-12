"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.averageBlockTime = void 0;
exports.uaktToAKT = uaktToAKT;
exports.aktToUakt = aktToUakt;
exports.coinToUDenom = coinToUDenom;
exports.coinToDenom = coinToDenom;
exports.getAvgCostPerMonth = getAvgCostPerMonth;
exports.getTimeLeft = getTimeLeft;
exports.toReadableDenom = toReadableDenom;
var add_1 = require("date-fns/add");
var denom_config_1 = require("@src/config/denom.config");
var useDenom_1 = require("@src/hooks/useDenom");
var dateUtils_1 = require("./dateUtils");
var mathHelpers_1 = require("./mathHelpers");
exports.averageBlockTime = 6.098;
function uaktToAKT(amount, precision) {
    if (precision === void 0) { precision = 3; }
    return Math.round((amount / 1000000 + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}
function aktToUakt(amount) {
    return Math.round((typeof amount === "string" ? parseFloat(amount) : amount) * 1000000);
}
function coinToUDenom(coin) {
    var value = null;
    var usdcDenom = (0, useDenom_1.getUsdcDenom)();
    if (coin.denom === "akt") {
        value = (0, mathHelpers_1.denomToUdenom)(parseFloat(coin.amount));
    }
    else if (coin.denom === denom_config_1.UAKT_DENOM || coin.denom === usdcDenom) {
        value = parseFloat(coin.amount);
    }
    else {
        throw Error("Unrecognized denom: " + coin.denom);
    }
    return value;
}
function coinToDenom(coin) {
    var value = null;
    var usdcDenom = (0, useDenom_1.getUsdcDenom)();
    if (coin.denom === "akt") {
        value = parseFloat(coin.amount);
    }
    else if (coin.denom === denom_config_1.UAKT_DENOM || coin.denom === usdcDenom) {
        value = uaktToAKT(parseFloat(coin.amount), 6);
    }
    else {
        throw Error("Unrecognized denom: " + coin.denom);
    }
    return value;
}
function getAvgCostPerMonth(pricePerBlock) {
    return (pricePerBlock * dateUtils_1.averageDaysInMonth * 24 * 60 * 60) / exports.averageBlockTime;
}
function getTimeLeft(pricePerBlock, balance) {
    var blocksLeft = balance / pricePerBlock;
    var timestamp = new Date().getTime();
    return (0, add_1.default)(new Date(timestamp), { seconds: blocksLeft * exports.averageBlockTime });
}
function toReadableDenom(denom) {
    return denom_config_1.READABLE_DENOMS[denom];
}
