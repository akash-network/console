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
exports.MANAGED_WALLET_ALLOWED_AUDITORS = exports.AUDITOR = exports.TRIAL_REGISTERED_ATTRIBUTE = exports.TRIAL_ATTRIBUTE = exports.ENDPOINT_NAME_VALIDATION_REGEX = void 0;
exports.getManifest = getManifest;
exports.getManifestVersion = getManifestVersion;
exports.appendTrialAttribute = appendTrialAttribute;
exports.appendAuditorRequirement = appendAuditorRequirement;
exports.NewDeploymentData = NewDeploymentData;
var js_yaml_1 = require("js-yaml");
var browser_env_config_1 = require("@src/config/browser-env.config");
var networkStore_1 = require("@src/store/networkStore");
var helpers_1 = require("./helpers");
exports.ENDPOINT_NAME_VALIDATION_REGEX = /^[a-z]+[-_\da-z]+$/;
exports.TRIAL_ATTRIBUTE = "console/trials";
exports.TRIAL_REGISTERED_ATTRIBUTE = "console/trials-registered";
exports.AUDITOR = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
exports.MANAGED_WALLET_ALLOWED_AUDITORS = [exports.AUDITOR];
function getManifest(yamlJson, asString) {
    return (0, helpers_1.Manifest)(yamlJson, "beta3", networkStore_1.default.selectedNetworkId, asString);
}
function getManifestVersion(yamlJson) {
    return __awaiter(this, void 0, void 0, function () {
        var version;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, helpers_1.ManifestVersion)(yamlJson, "beta3", networkStore_1.default.selectedNetworkId)];
                case 1:
                    version = _a.sent();
                    return [2 /*return*/, Buffer.from(version).toString("base64")];
            }
        });
    });
}
var getDenomFromSdl = function (groups) {
    var denoms = groups.flatMap(function (g) { return g.resources; }).map(function (resource) { return resource.price.denom; });
    // TODO handle multiple denoms in an sdl? (different denom for each service?)
    return denoms[0];
};
function appendTrialAttribute(yamlStr, attributeKey) {
    var _a, _b, _c, _d, _e, _f;
    var sdl = (0, helpers_1.getSdl)(yamlStr, "beta3", networkStore_1.default.selectedNetworkId);
    var placementData = ((_b = (_a = sdl.data) === null || _a === void 0 ? void 0 : _a.profiles) === null || _b === void 0 ? void 0 : _b.placement) || {};
    for (var _i = 0, _g = Object.entries(placementData); _i < _g.length; _i++) {
        var _h = _g[_i], value = _h[1];
        if (!value.attributes) {
            value.attributes = [];
        }
        else if (!Array.isArray(value.attributes)) {
            value.attributes = Object.entries(value.attributes).map(function (_a) {
                var key = _a[0], value = _a[1];
                return ({ key: key, value: value });
            });
        }
        var hasTrialAttribute = value.attributes.find(function (attr) { return attr.key === attributeKey; });
        if (!hasTrialAttribute) {
            value.attributes.push({ key: attributeKey, value: "true" });
        }
        if (!((_c = value.signedBy) === null || _c === void 0 ? void 0 : _c.anyOf) || !((_d = value.signedBy) === null || _d === void 0 ? void 0 : _d.allOf)) {
            value.signedBy = {
                anyOf: ((_e = value.signedBy) === null || _e === void 0 ? void 0 : _e.anyOf) || [],
                allOf: ((_f = value.signedBy) === null || _f === void 0 ? void 0 : _f.allOf) || []
            };
        }
        if (!value.signedBy.allOf.includes(exports.AUDITOR)) {
            value.signedBy.allOf.push(exports.AUDITOR);
        }
    }
    var result = js_yaml_1.default.dump(sdl.data, {
        indent: 2,
        quotingType: '"',
        styles: {
            "!!null": "empty" // dump null as empty value
        },
        replacer: function (key, value) {
            var isCurrentKeyProviderAttributes = key === "attributes" && Array.isArray(value) && value.some(function (attr) { return attr.key === attributeKey; });
            if (isCurrentKeyProviderAttributes) {
                return mapProviderAttributes(value);
            }
            return value;
        }
    });
    return "---\n".concat(result);
}
function appendAuditorRequirement(yamlStr) {
    var _a, _b, _c, _d, _e, _f;
    var sdl = (0, helpers_1.getSdl)(yamlStr, "beta3", networkStore_1.default.selectedNetworkId);
    var placementData = ((_b = (_a = sdl.data) === null || _a === void 0 ? void 0 : _a.profiles) === null || _b === void 0 ? void 0 : _b.placement) || {};
    for (var _i = 0, _g = Object.entries(placementData); _i < _g.length; _i++) {
        var _h = _g[_i], value = _h[1];
        if (!((_c = value.signedBy) === null || _c === void 0 ? void 0 : _c.anyOf) || !((_d = value.signedBy) === null || _d === void 0 ? void 0 : _d.allOf)) {
            value.signedBy = {
                anyOf: ((_e = value.signedBy) === null || _e === void 0 ? void 0 : _e.anyOf) || [],
                allOf: ((_f = value.signedBy) === null || _f === void 0 ? void 0 : _f.allOf) || []
            };
        }
        for (var _j = 0, MANAGED_WALLET_ALLOWED_AUDITORS_1 = exports.MANAGED_WALLET_ALLOWED_AUDITORS; _j < MANAGED_WALLET_ALLOWED_AUDITORS_1.length; _j++) {
            var auditor = MANAGED_WALLET_ALLOWED_AUDITORS_1[_j];
            if (!value.signedBy.anyOf.includes(auditor)) {
                value.signedBy.anyOf.push(auditor);
            }
        }
    }
    var result = js_yaml_1.default.dump(sdl.data, {
        indent: 2,
        quotingType: '"',
        styles: {
            "!!null": "empty"
        }
    });
    return "---\n".concat(result);
}
// Attributes is a key value pair object, but we store it as an array of objects with key and value
function mapProviderAttributes(attributes) {
    return attributes === null || attributes === void 0 ? void 0 : attributes.reduce(function (acc, curr) { return ((acc[curr.key] = curr.value), acc); }, {});
}
function NewDeploymentData(chainApiHttpClient_1, yamlStr_1, dseq_1, fromAddress_1) {
    return __awaiter(this, arguments, void 0, function (chainApiHttpClient, yamlStr, dseq, fromAddress, deposit) {
        var networkId, sdl, groups, mani, denom_1, version, _deposit, finalDseq, response, e_1, error;
        if (deposit === void 0) { deposit = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    networkId = networkStore_1.default.selectedNetworkId;
                    sdl = (0, helpers_1.getSdl)(yamlStr, "beta3", networkId);
                    groups = sdl.groups();
                    mani = sdl.manifest();
                    denom_1 = getDenomFromSdl(groups);
                    return [4 /*yield*/, sdl.manifestVersion()];
                case 1:
                    version = _a.sent();
                    _deposit = (Array.isArray(deposit) && deposit.find(function (d) { return d.denom === denom_1; })) || { denom: denom_1, amount: deposit.toString() };
                    finalDseq = dseq || "";
                    if (!!finalDseq) return [3 /*break*/, 3];
                    return [4 /*yield*/, chainApiHttpClient.get("/cosmos/base/tendermint/v1beta1/blocks/latest")];
                case 2:
                    response = _a.sent();
                    finalDseq = response.data.block.header.height;
                    _a.label = 3;
                case 3: return [2 /*return*/, {
                        sdl: sdl.data,
                        manifest: mani,
                        groups: groups,
                        deploymentId: {
                            owner: fromAddress,
                            dseq: finalDseq
                        },
                        orderId: [],
                        leaseId: [],
                        hash: version,
                        deposit: _deposit
                    }];
                case 4:
                    e_1 = _a.sent();
                    error = new helpers_1.CustomValidationError(e_1.message);
                    error.stack = e_1.stack;
                    throw error;
                case 5: return [2 /*return*/];
            }
        });
    });
}
