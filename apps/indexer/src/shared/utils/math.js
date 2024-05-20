"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uaktToAKT = exports.round = exports.pickRandomElement = void 0;
function pickRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
exports.pickRandomElement = pickRandomElement;
function round(amount, precision = 2) {
    return Math.round((amount + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}
exports.round = round;
function uaktToAKT(amount, precision = 2) {
    return round(amount / 1000000, precision);
}
exports.uaktToAKT = uaktToAKT;
//# sourceMappingURL=math.js.map