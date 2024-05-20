"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pubkeyToRawAddress = exports.rawEd25519PubkeyToRawAddress = exports.rawSecp256k1PubkeyToRawAddress = exports.parseBech32 = exports.isValidBech32Address = void 0;
const crypto_1 = require("@cosmjs/crypto");
const encoding_1 = require("@cosmjs/encoding");
function isValidBech32Address(address, prefix) {
    const bech32 = parseBech32(address);
    return bech32 && (!prefix || bech32.prefix === prefix);
}
exports.isValidBech32Address = isValidBech32Address;
function parseBech32(str) {
    try {
        return (0, encoding_1.fromBech32)(str);
    }
    catch (_a) {
        return null;
    }
}
exports.parseBech32 = parseBech32;
// FROM https://github.com/cosmos/cosmjs/blob/79396bfaa49831127ccbbbfdbb1185df14230c63/packages/tendermint-rpc/src/addresses.ts
function rawSecp256k1PubkeyToRawAddress(pubkeyData) {
    if (pubkeyData.length !== 33) {
        throw new Error(`Invalid Secp256k1 pubkey length (compressed): ${pubkeyData.length}`);
    }
    return (0, crypto_1.ripemd160)((0, crypto_1.sha256)(pubkeyData));
}
exports.rawSecp256k1PubkeyToRawAddress = rawSecp256k1PubkeyToRawAddress;
// FROM https://github.com/cosmos/cosmjs/blob/79396bfaa49831127ccbbbfdbb1185df14230c63/packages/tendermint-rpc/src/addresses.ts
function rawEd25519PubkeyToRawAddress(pubkeyData) {
    if (pubkeyData.length !== 32) {
        throw new Error(`Invalid Ed25519 pubkey length: ${pubkeyData.length}`);
    }
    return (0, crypto_1.sha256)(pubkeyData).slice(0, 20);
}
exports.rawEd25519PubkeyToRawAddress = rawEd25519PubkeyToRawAddress;
// For secp256k1 this assumes we already have a compressed pubkey.
function pubkeyToRawAddress(type, data) {
    switch (type) {
        case "/cosmos.crypto.ed25519.PubKey":
            return rawEd25519PubkeyToRawAddress(data);
        case "/cosmos.crypto.secp256k1.PubKey":
            return rawSecp256k1PubkeyToRawAddress(data);
        default:
            // Keep this case here to guard against new types being added but not handled
            throw new Error(`Pubkey type ${type} not supported`);
    }
}
exports.pubkeyToRawAddress = pubkeyToRawAddress;
//# sourceMappingURL=addresses.js.map