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
exports.rsaPublicKeyToOpenSSH = rsaPublicKeyToOpenSSH;
exports.generateSSHKeyPair = generateSSHKeyPair;
var jsrsasign_1 = require("jsrsasign");
var encoding_1 = require("./encoding");
function numberToBytes(num) {
    return [(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}
function hexToBytes(hex) {
    if (hex.length % 2 !== 0) {
        hex = "0" + hex;
    }
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}
function encodeLengthPrefixed(data) {
    var bytes = typeof data === "string" ? Array.from(new TextEncoder().encode(data)) : data;
    return __spreadArray(__spreadArray([], numberToBytes(bytes.length), true), bytes, true);
}
function rsaPublicKeyToOpenSSH(publicPem, comment) {
    if (comment === void 0) { comment = "user@host"; }
    var keyObj = jsrsasign_1.KEYUTIL.getKey(publicPem);
    var nHex = keyObj.n.toString(16);
    var eHex = keyObj.e.toString(16);
    var nBytes = hexToBytes(nHex);
    var eBytes = hexToBytes(eHex);
    var sshRsaStr = "ssh-rsa";
    var parts = __spreadArray(__spreadArray(__spreadArray([], encodeLengthPrefixed(sshRsaStr), true), encodeLengthPrefixed(eBytes), true), encodeLengthPrefixed(nBytes), true);
    var base64 = (0, encoding_1.toBase64)(new Uint8Array(parts));
    return "".concat(sshRsaStr, " ").concat(base64, " ").concat(comment);
}
function generateSSHKeyPair() {
    var kp = jsrsasign_1.KEYUTIL.generateKeypair("RSA", 2048);
    var prvKeyObj = kp.prvKeyObj;
    var pubKeyObj = kp.pubKeyObj;
    var privatePem = jsrsasign_1.KEYUTIL.getPEM(prvKeyObj, "PKCS1PRV");
    var publicPem = jsrsasign_1.KEYUTIL.getPEM(pubKeyObj);
    var publicKey = rsaPublicKeyToOpenSSH(publicPem);
    return {
        publicKey: publicKey,
        privateKey: privatePem,
        publicPem: publicPem,
        privatePem: privatePem
    };
}
