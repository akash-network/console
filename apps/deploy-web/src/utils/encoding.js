"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBase64 = toBase64;
exports.fromBase64 = fromBase64;
var encoding_1 = require("@cosmjs/encoding");
function toBase64(data) {
    if (typeof data === "string") {
        return btoa(data);
    }
    if ("toBase64" in data && typeof data.toBase64 === "function") {
        return data.toBase64();
    }
    return (0, encoding_1.toBase64)(data);
}
function fromBase64(data) {
    if ("fromBase64" in Uint8Array && typeof Uint8Array.fromBase64 === "function") {
        return Uint8Array.fromBase64(data);
    }
    return (0, encoding_1.fromBase64)(data);
}
