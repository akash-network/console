"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAmountFromCoin = exports.getAmountFromCoinArray = void 0;
function getAmountFromCoinArray(coins, denom) {
    const coin = coins.find((coin) => coin.denom === denom);
    return coin ? parseInt(coin.amount) : 0;
}
exports.getAmountFromCoinArray = getAmountFromCoinArray;
function getAmountFromCoin(coin, denom) {
    if (denom && coin.denom !== denom) {
        return 0;
    }
    return parseInt(coin.amount);
}
exports.getAmountFromCoin = getAmountFromCoin;
//# sourceMappingURL=coin.js.map