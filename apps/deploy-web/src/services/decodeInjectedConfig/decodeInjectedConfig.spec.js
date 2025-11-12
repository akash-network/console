"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_1 = require("crypto");
var decodeInjectedConfig_1 = require("./decodeInjectedConfig");
describe(decodeInjectedConfig_1.decodeInjectedConfig.name, function () {
    beforeAll(function () {
        if (!window.crypto.subtle) {
            Object.defineProperty(globalThis, "crypto", {
                value: crypto_1.webcrypto,
                writable: true
            });
        }
    });
    it("returns null if public key is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)(undefined)];
                case 1:
                    config = _a.sent();
                    expect(config).toBeNull();
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)()];
                case 2:
                    config = _a.sent();
                    expect(config).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns null if __AK_INJECTED_CONFIG__ is not a string", function () { return __awaiter(void 0, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    window.__AK_INJECTED_CONFIG__ = 1;
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)("test pem")];
                case 1:
                    config = _a.sent();
                    expect(config).toBeNull();
                    window.__AK_INJECTED_CONFIG__ = undefined;
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)("test pem")];
                case 2:
                    config = _a.sent();
                    expect(config).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("return null if __AK_INJECTED_CONFIG__ is of invalid format", function () { return __awaiter(void 0, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    window.__AK_INJECTED_CONFIG__ = "test config";
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)("test pem")];
                case 1:
                    config = _a.sent();
                    expect(config).toBeNull();
                    window.__AK_INJECTED_CONFIG__ = "test config.";
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)("test pem")];
                case 2:
                    config = _a.sent();
                    expect(config).toBeNull();
                    window.__AK_INJECTED_CONFIG__ = ".test signature";
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)("test pem")];
                case 3:
                    config = _a.sent();
                    expect(config).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns null if signature is invalid", function () { return __awaiter(void 0, void 0, void 0, function () {
        var config, signedConfig, publicKey, decodedConfig;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = {
                        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test site key"
                    };
                    signedConfig = signConfig(config).signedConfig;
                    publicKey = (0, crypto_1.generateKeyPairSync)("rsa", {
                        modulusLength: 2048
                    }).publicKey;
                    window.__AK_INJECTED_CONFIG__ = signedConfig;
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)(publicKey.export({ type: "spki", format: "pem" }))];
                case 1:
                    decodedConfig = _a.sent();
                    expect(decodedConfig).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns null if config is not a valid JSON", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, signedConfig, publicKey, _b, signature, decodedConfig;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = signConfig({}), signedConfig = _a.signedConfig, publicKey = _a.publicKey;
                    _b = signedConfig.split(".", 2), signature = _b[1];
                    window.__AK_INJECTED_CONFIG__ = "not valid json.".concat(signature);
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)(publicKey.export({ type: "spki", format: "pem" }))];
                case 1:
                    decodedConfig = _c.sent();
                    expect(decodedConfig).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it("returns config if signature is valid", function () { return __awaiter(void 0, void 0, void 0, function () {
        var config, _a, signedConfig, publicKey, decodedConfig;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    config = {
                        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test site key"
                    };
                    _a = signConfig(config), signedConfig = _a.signedConfig, publicKey = _a.publicKey;
                    window.__AK_INJECTED_CONFIG__ = signedConfig;
                    return [4 /*yield*/, (0, decodeInjectedConfig_1.decodeInjectedConfig)(publicKey.export({ type: "spki", format: "pem" }))];
                case 1:
                    decodedConfig = _b.sent();
                    expect(decodedConfig).toEqual(config);
                    return [2 /*return*/];
            }
        });
    }); });
    function signConfig(config) {
        var _a = (0, crypto_1.generateKeyPairSync)("rsa", {
            modulusLength: 2048
        }), publicKey = _a.publicKey, privateKey = _a.privateKey;
        var serializedConfig = JSON.stringify(config);
        var sign = (0, crypto_1.createSign)("SHA256");
        sign.update(JSON.stringify(config));
        sign.end();
        var signature = sign.sign(privateKey, "base64");
        return {
            signedConfig: "".concat(serializedConfig, ".").concat(signature),
            privateKey: privateKey,
            publicKey: publicKey
        };
    }
});
