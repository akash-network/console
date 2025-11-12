"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsaPublicKeyToOpenSSH = rsaPublicKeyToOpenSSH;
exports.generateSSHKeyPair = generateSSHKeyPair;
var jsrsasign_1 = require("jsrsasign");
var encoding_1 = require("./encoding");
function numberToBytes(num) {
    return new Uint8Array([(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]);
}
function hexToBytes(hex) {
    if (hex.length % 2 !== 0) {
        hex = "0" + hex;
    }
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}
function encodeLengthPrefixed(data) {
    var bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    var lengthBytes = numberToBytes(bytes.length);
    var result = new Uint8Array(lengthBytes.length + bytes.length);
    result.set(lengthBytes, 0);
    result.set(bytes, lengthBytes.length);
    return result;
}
function rsaPublicKeyToOpenSSH(publicPem, comment) {
    if (comment === void 0) { comment = "user@host"; }
    var keyObj = jsrsasign_1.KEYUTIL.getKey(publicPem);
    var nHex = keyObj.n.toString(16);
    var eHex = keyObj.e.toString(16);
    var nBytes = hexToBytes(nHex);
    var eBytes = hexToBytes(eHex);
    var sshRsaStr = "ssh-rsa";
    var parts = [
        encodeLengthPrefixed(sshRsaStr),
        encodeLengthPrefixed(eBytes),
        encodeLengthPrefixed(nBytes)
    ];
    var totalLength = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var result = new Uint8Array(totalLength);
    var offset = 0;
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        result.set(part, offset);
        offset += part.length;
    }
    var base64 = (0, encoding_1.toBase64)(result);
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
