"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidBech32Address = isValidBech32Address;
exports.parseBech32 = parseBech32;
var encoding_1 = require("@cosmjs/encoding");
function isValidBech32Address(address, prefix) {
    var bech32 = parseBech32(address);
    return bech32 && (!prefix || bech32.prefix === prefix);
}
function parseBech32(str) {
    try {
        return (0, encoding_1.fromBech32)(str);
    }
    catch (_a) {
        return null;
    }
}
