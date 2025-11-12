"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.DEPENDENCIES = void 0;
exports.useProviderJwt = useProviderJwt;
var react_1 = require("react");
var web_1 = require("@akashnetwork/chain-sdk/web");
var jotai_1 = require("jotai");
var CustomChainProvider_1 = require("@src/context/CustomChainProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var JWT_TOKEN_ATOM = (0, jotai_1.atom)(null);
exports.DEPENDENCIES = {
    useSelectedChain: CustomChainProvider_1.useSelectedChain,
    useWallet: WalletProvider_1.useWallet,
    useServices: ServicesProvider_1.useServices
};
function useProviderJwt(_a) {
    var _this = this;
    var _b = _a === void 0 ? {} : _a, _c = _b.dependencies, d = _c === void 0 ? exports.DEPENDENCIES : _c;
    var _d = d.useServices(), storedWalletsService = _d.storedWalletsService, networkStore = _d.networkStore, consoleApiHttpClient = _d.consoleApiHttpClient;
    var _e = d.useWallet(), isManaged = _e.isManaged, address = _e.address, isWalletConnected = _e.isWalletConnected;
    var selectedChain = d.useSelectedChain();
    var selectedNetworkId = networkStore.useSelectedNetworkId();
    var _f = (0, jotai_1.useAtom)(JWT_TOKEN_ATOM), accessToken = _f[0], setAccessToken = _f[1];
    (0, react_1.useEffect)(function () {
        var _a;
        var token = (_a = storedWalletsService.getStorageWallets(selectedNetworkId).find(function (w) { return w.address === address; })) === null || _a === void 0 ? void 0 : _a.token;
        setAccessToken(token || null);
    }, [storedWalletsService, selectedNetworkId, address]);
    var jwtTokenManager = (0, react_1.useMemo)(function () {
        return new web_1.JwtTokenManager({
            signArbitrary: selectedChain
                ? selectedChain.signArbitrary
                : function () {
                    throw new Error("Cannot sign jwt token: custodial wallet not found");
                }
        });
    }, [selectedChain]);
    var parsedToken = (0, react_1.useMemo)(function () {
        if (!accessToken)
            return null;
        return jwtTokenManager.decodeToken(accessToken);
    }, [accessToken, jwtTokenManager]);
    var generateToken = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var leasesAccess, tokenLifetimeInSeconds, token, response, now;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isWalletConnected)
                        return [2 /*return*/];
                    leasesAccess = {
                        access: "scoped",
                        scope: ["status", "shell", "events", "logs"]
                    };
                    tokenLifetimeInSeconds = 30 * 60;
                    if (!isManaged) return [3 /*break*/, 2];
                    return [4 /*yield*/, consoleApiHttpClient.post("/v1/create-jwt-token", {
                            data: {
                                ttl: tokenLifetimeInSeconds,
                                leases: leasesAccess
                            }
                        })];
                case 1:
                    response = _a.sent();
                    token = response.data.data.token;
                    return [3 /*break*/, 4];
                case 2:
                    now = Math.floor(Date.now() / 1000);
                    return [4 /*yield*/, jwtTokenManager.generateToken({
                            version: "v1",
                            iss: address,
                            exp: now + tokenLifetimeInSeconds,
                            iat: now,
                            leases: leasesAccess
                        })];
                case 3:
                    token = _a.sent();
                    _a.label = 4;
                case 4:
                    storedWalletsService.updateWallet(address, function (w) { return (__assign(__assign({}, w), { token: token })); });
                    setAccessToken(token);
                    return [2 /*return*/];
            }
        });
    }); }, [isWalletConnected, isManaged, selectedChain, jwtTokenManager, address, consoleApiHttpClient]);
    return (0, react_1.useMemo)(function () { return ({
        get isTokenExpired() {
            return !!parsedToken && parsedToken.exp <= Math.floor(Date.now() / 1000);
        },
        accessToken: accessToken,
        generateToken: generateToken
    }); }, [accessToken, generateToken]);
}
