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
var jest_mock_extended_1 = require("jest-mock-extended");
var useProviderJwt_1 = require("./useProviderJwt");
var react_1 = require("@testing-library/react");
var query_client_1 = require("@tests/unit/query-client");
describe(useProviderJwt_1.useProviderJwt.name, function () {
    it("returns initial state with no token", function () {
        var result = setup().result;
        expect(result.current.accessToken).toBeNull();
        expect(result.current.isTokenExpired).toBe(false);
        expect(typeof result.current.generateToken).toBe("function");
    });
    it("retrieves token from storage when wallet address changes", function () {
        var token = genFakeToken();
        var storedWalletsService = (0, jest_mock_extended_1.mock)({
            getStorageWallets: jest.fn().mockReturnValue([{ address: "akash1234567890", token: token }])
        });
        var result = setup({
            services: {
                storedWalletsService: function () { return storedWalletsService; }
            },
            wallet: {
                address: "akash1234567890"
            }
        }).result;
        expect(result.current.accessToken).toBe(token);
        expect(storedWalletsService.getStorageWallets).toHaveBeenCalledWith("mainnet");
    });
    it("generates token for managed wallet via API", function () { return __awaiter(void 0, void 0, void 0, function () {
        var token, consoleApiHttpClient, storedWalletsService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    token = genFakeToken();
                    consoleApiHttpClient = (0, jest_mock_extended_1.mock)({
                        post: jest.fn().mockResolvedValue({
                            data: { data: { token: token } }
                        })
                    });
                    storedWalletsService = (0, jest_mock_extended_1.mock)({
                        updateWallet: jest.fn(),
                        getStorageWallets: jest.fn().mockReturnValue([{ address: "akash1234567890", token: token }])
                    });
                    result = setup({
                        services: {
                            consoleApiHttpClient: function () { return consoleApiHttpClient; },
                            storedWalletsService: function () { return storedWalletsService; }
                        },
                        wallet: {
                            isManaged: true,
                            isWalletConnected: true,
                            address: "akash1234567890"
                        }
                    }).result;
                    return [4 /*yield*/, result.current.generateToken()];
                case 1:
                    _a.sent();
                    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
                        data: {
                            ttl: 1800, // 30 * 60
                            leases: {
                                access: "scoped",
                                scope: ["status", "shell", "events", "logs"]
                            }
                        }
                    });
                    expect(storedWalletsService.updateWallet).toHaveBeenCalledWith("akash1234567890", expect.any(Function));
                    expect(result.current.accessToken).toBe(token);
                    return [2 /*return*/];
            }
        });
    }); });
    it("generates token for non-managed wallet via direct signing", function () { return __awaiter(void 0, void 0, void 0, function () {
        var address, custodialWallet, storedWallets, storedWalletsService, result, _a, signature;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    address = "akash1".padEnd(6 + 38, "0");
                    custodialWallet = (0, jest_mock_extended_1.mock)({
                        address: address,
                        signArbitrary: jest.fn().mockResolvedValue({ signature: btoa("signature") })
                    });
                    storedWallets = [{ address: address }];
                    storedWalletsService = (0, jest_mock_extended_1.mock)({
                        getStorageWallets: jest.fn(function () { return storedWallets; }),
                        updateWallet: jest.fn(function (address, fn) {
                            var walletIndex = storedWallets.findIndex(function (w) { return w.address === address; });
                            if (walletIndex !== -1) {
                                storedWallets[walletIndex] = fn(storedWallets[walletIndex]);
                            }
                            return storedWallets;
                        })
                    });
                    result = setup({
                        services: {
                            storedWalletsService: function () { return storedWalletsService; }
                        },
                        wallet: {
                            isManaged: false,
                            address: address
                        },
                        custodialWallet: custodialWallet
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return result.current.generateToken(); })];
                case 1:
                    _d.sent();
                    expect(custodialWallet.signArbitrary).toHaveBeenCalledWith(address, expect.any(String));
                    expect(storedWalletsService.updateWallet).toHaveBeenCalledWith(address, expect.any(Function));
                    _a = (_c = (_b = result.current.accessToken) === null || _b === void 0 ? void 0 : _b.split(".")) !== null && _c !== void 0 ? _c : [], signature = _a[2];
                    expect(atob(signature)).toBe("signature");
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not generate token when wallet is not connected", function () { return __awaiter(void 0, void 0, void 0, function () {
        var consoleApiHttpClient, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    consoleApiHttpClient = (0, jest_mock_extended_1.mock)({
                        post: jest.fn()
                    });
                    result = setup({
                        services: {
                            consoleApiHttpClient: function () { return consoleApiHttpClient; }
                        },
                        wallet: {
                            isWalletConnected: false
                        }
                    }).result;
                    return [4 /*yield*/, result.current.generateToken()];
                case 1:
                    _a.sent();
                    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("detects expired token correctly", function () {
        var pastTime = Math.floor(Date.now() / 1000) - 100;
        var result = setup({
            initialToken: genFakeToken({ exp: pastTime })
        }).result;
        expect(result.current.isTokenExpired).toBe(true);
    });
    it("detects valid token correctly", function () {
        var futureTime = Math.floor(Date.now() / 1000) + 3600;
        var result = setup({
            initialToken: genFakeToken({ exp: futureTime })
        }).result;
        expect(result.current.isTokenExpired).toBe(false);
    });
    function setup(input) {
        return (0, query_client_1.setupQuery)(function () {
            return (0, useProviderJwt_1.useProviderJwt)({
                dependencies: __assign(__assign({}, useProviderJwt_1.DEPENDENCIES), { useWallet: function () { return (__assign({ address: "akash1234567890", walletName: "test-wallet", isWalletLoaded: true, connectManagedWallet: jest.fn(), logout: jest.fn(), signAndBroadcastTx: jest.fn(), isManaged: false, isWalletConnected: true, isCustodial: false, isWalletLoading: false, isTrialing: false, isOnboarding: false, creditAmount: 0, switchWalletType: jest.fn(), hasManagedWallet: false, managedWalletError: undefined }, input === null || input === void 0 ? void 0 : input.wallet)); }, useSelectedChain: function () {
                        var _a;
                        return (_a = input === null || input === void 0 ? void 0 : input.custodialWallet) !== null && _a !== void 0 ? _a : (0, jest_mock_extended_1.mock)({
                            signArbitrary: jest.fn()
                        });
                    } })
            });
        }, {
            services: __assign({ networkStore: function () {
                    return (0, jest_mock_extended_1.mock)({
                        useSelectedNetworkId: function () { return "mainnet"; }
                    });
                }, storedWalletsService: function () {
                    return (0, jest_mock_extended_1.mock)({
                        getStorageWallets: function () {
                            return (input === null || input === void 0 ? void 0 : input.initialToken) ? [{ address: "akash1234567890", token: input.initialToken }] : [];
                        }
                    });
                }, consoleApiHttpClient: function () { return (0, jest_mock_extended_1.mock)(); } }, input === null || input === void 0 ? void 0 : input.services)
        });
    }
    function genFakeToken(payload) {
        if (payload === void 0) { payload = {}; }
        return "header.".concat(btoa(JSON.stringify(__assign({ version: "v1", iss: "akash1234567890", exp: Date.now() + 3600, iat: Date.now(), leases: { access: "full" } }, payload))), ".signature");
    }
});
