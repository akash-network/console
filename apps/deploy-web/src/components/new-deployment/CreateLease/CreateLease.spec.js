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
var akash_v1_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1");
var akash_v1beta5_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta5");
var jest_mock_extended_1 = require("jest-mock-extended");
var useBidQuery_1 = require("@src/queries/useBidQuery");
var walletUtils_1 = require("@src/utils/walletUtils");
var CreateLease_1 = require("./CreateLease");
var react_1 = require("@testing-library/react");
var user_event_1 = require("@testing-library/user-event");
var bid_1 = require("@tests/seeders/bid");
var block_1 = require("@tests/seeders/block");
var manifest_1 = require("@tests/seeders/manifest");
var provider_1 = require("@tests/seeders/provider");
var mocks_1 = require("@tests/unit/mocks");
var TestContainerProvider_1 = require("@tests/unit/TestContainerProvider");
describe(CreateLease_1.CreateLease.name, function () {
    it("displays bids and a button to create a lease", function () { return __awaiter(void 0, void 0, void 0, function () {
        var BidGroup, bids, getByRole;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    BidGroup = jest.fn(mocks_1.ComponentMock);
                    bids = [
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "open"
                            }
                        }),
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "open"
                            }
                        })
                    ];
                    getByRole = setup({
                        BidGroup: BidGroup,
                        bids: bids
                    }).getByRole;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(getByRole("button", { name: /Accept Bid/i })).toBeInTheDocument();
                            expect(BidGroup).toHaveBeenCalledWith(expect.objectContaining({
                                gseq: 1,
                                bids: expect.arrayContaining(bids.map(useBidQuery_1.mapToBidDto))
                            }), {});
                            expect(BidGroup).toHaveBeenCalledTimes(1);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("groups bids by gseq", function () { return __awaiter(void 0, void 0, void 0, function () {
        var BidGroup, bids, getByRole;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    BidGroup = jest.fn(mocks_1.ComponentMock);
                    bids = [
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "open"
                            }
                        }),
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 2
                                },
                                state: "open"
                            }
                        })
                    ];
                    getByRole = setup({
                        BidGroup: BidGroup,
                        bids: bids
                    }).getByRole;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(getByRole("button", { name: /Accept Bid/i })).toBeInTheDocument();
                            expect(BidGroup).toHaveBeenCalledWith(expect.objectContaining({
                                gseq: 1,
                                bids: bids.filter(function (b) { return b.bid.id.gseq === 1; }).map(useBidQuery_1.mapToBidDto)
                            }), {});
                            expect(BidGroup).toHaveBeenCalledWith(expect.objectContaining({
                                gseq: 2,
                                bids: bids.filter(function (b) { return b.bid.id.gseq === 2; }).map(useBidQuery_1.mapToBidDto)
                            }), {});
                            expect(BidGroup).toHaveBeenCalledTimes(2);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("displays 'Close Deployment' button if all bids are closed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var bids, _a, getByRole, queryByRole;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    bids = [
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "closed"
                            }
                        }),
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "closed"
                            }
                        })
                    ];
                    _a = setup({
                        bids: bids
                    }), getByRole = _a.getByRole, queryByRole = _a.queryByRole;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(getByRole("button", { name: /Close Deployment/i })).toBeInTheDocument();
                            expect(queryByRole("button", { name: /Accept Bid/i })).not.toBeInTheDocument();
                        })];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("doesn't throw error if block is null-ish", function () { return __awaiter(void 0, void 0, void 0, function () {
        var getByText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    jest.useFakeTimers();
                    getByText = setup({
                        bids: [],
                        isTrialWallet: true,
                        getBlock: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, null];
                        }); }); }
                    }).getByText;
                    return [4 /*yield*/, (0, react_1.act)(function () { return jest.runOnlyPendingTimersAsync(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(getByText(/Waiting for bids/i)).toBeInTheDocument();
                        })];
                case 2:
                    _a.sent();
                    jest.useRealTimers();
                    return [2 /*return*/];
            }
        });
    }); });
    it("disables Accept Bid button when blockchain is unavailable", function () { return __awaiter(void 0, void 0, void 0, function () {
        var BidGroup, bids;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    BidGroup = jest.fn(mocks_1.ComponentMock);
                    bids = [
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "open"
                            }
                        }),
                        (0, bid_1.buildRpcBid)({
                            bid: {
                                id: {
                                    gseq: 1
                                },
                                state: "open"
                            }
                        })
                    ];
                    setup({
                        BidGroup: BidGroup,
                        bids: bids,
                        isBlockchainDown: true
                    });
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(react_1.screen.getByText(/Blockchain is unavailable/i)).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe("lease creation", function () {
        it("creates lease on chain and submits manifest to provider", function () { return __awaiter(void 0, void 0, void 0, function () {
            var signAndBroadcastTx, sendManifest, localCert, dseq, selectedProvider;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        signAndBroadcastTx = jest.fn().mockResolvedValue({ code: 0 });
                        sendManifest = jest.fn();
                        localCert = {
                            certPem: "certPem",
                            keyPem: "keyPem",
                            address: "akash123"
                        };
                        dseq = "123";
                        selectedProvider = (0, provider_1.buildProvider)();
                        return [4 /*yield*/, setupLeaseCreation({ signAndBroadcastTx: signAndBroadcastTx, sendManifest: sendManifest, localCert: localCert, dseq: dseq, selectedProvider: selectedProvider })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(react_1.screen.getByRole("button", { name: /Accept Bid/i })).not.toBeDisabled();
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, user_event_1.default.click(react_1.screen.getByRole("button", { name: /Accept Bid/i }))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(signAndBroadcastTx).toHaveBeenCalledWith([
                                    expect.objectContaining({
                                        typeUrl: "/".concat(akash_v1beta5_1.MsgCreateLease.$type)
                                    })
                                ]);
                                expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
                                    dseq: dseq,
                                    chainNetwork: "mainnet",
                                    credentials: {
                                        type: "mtls",
                                        value: {
                                            cert: localCert.certPem,
                                            key: localCert.keyPem
                                        }
                                    }
                                });
                            })];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("creates new certificate on lease creation if there is no local certificate or it is expired", function () { return __awaiter(void 0, void 0, void 0, function () {
            var signAndBroadcastTx, sendManifest, dseq, selectedProvider, newPemCert, genNewCertificateIfLocalIsInvalid, localCert, updateSelectedCertificate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        signAndBroadcastTx = jest.fn().mockResolvedValue({ code: 0 });
                        sendManifest = jest.fn();
                        dseq = "123";
                        selectedProvider = (0, provider_1.buildProvider)();
                        newPemCert = {
                            cert: "certPem",
                            publicKey: "publicKey",
                            privateKey: "privateKey"
                        };
                        genNewCertificateIfLocalIsInvalid = jest.fn().mockResolvedValue(newPemCert);
                        localCert = {
                            certPem: newPemCert.cert,
                            keyPem: newPemCert.privateKey,
                            address: "akash123"
                        };
                        updateSelectedCertificate = jest.fn().mockResolvedValue(localCert);
                        return [4 /*yield*/, setupLeaseCreation({
                                genNewCertificateIfLocalIsInvalid: genNewCertificateIfLocalIsInvalid,
                                updateSelectedCertificate: updateSelectedCertificate,
                                signAndBroadcastTx: signAndBroadcastTx,
                                sendManifest: sendManifest,
                                localCert: null,
                                dseq: dseq,
                                selectedProvider: selectedProvider
                            })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(react_1.screen.getByRole("button", { name: /Accept Bid/i })).not.toBeDisabled();
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, user_event_1.default.click(react_1.screen.getByRole("button", { name: /Accept Bid/i }))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(signAndBroadcastTx).toHaveBeenCalledWith(expect.arrayContaining([
                                    expect.objectContaining({
                                        typeUrl: "/".concat(akash_v1_1.MsgCreateCertificate.$type)
                                    }),
                                    expect.objectContaining({
                                        typeUrl: "/".concat(akash_v1beta5_1.MsgCreateLease.$type)
                                    })
                                ]));
                                expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
                                    dseq: dseq,
                                    chainNetwork: "mainnet",
                                    credentials: {
                                        type: "mtls",
                                        value: {
                                            cert: localCert.certPem,
                                            key: localCert.keyPem
                                        }
                                    }
                                });
                            })];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("creates certificate when 'Re-send Manifest' is clicked and certificate is expired", function () { return __awaiter(void 0, void 0, void 0, function () {
            var signAndBroadcastTx, sendManifest, dseq, selectedProvider, newPemCert, genNewCertificateIfLocalIsInvalid, localCert, updateSelectedCertificate, bids;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        signAndBroadcastTx = jest.fn().mockResolvedValue({ code: 0 });
                        sendManifest = jest.fn();
                        dseq = "123";
                        selectedProvider = (0, provider_1.buildProvider)();
                        newPemCert = {
                            cert: "certPem",
                            publicKey: "publicKey",
                            privateKey: "privateKey"
                        };
                        genNewCertificateIfLocalIsInvalid = jest.fn().mockResolvedValue(newPemCert);
                        localCert = {
                            certPem: newPemCert.cert,
                            keyPem: newPemCert.privateKey,
                            address: "akash123"
                        };
                        updateSelectedCertificate = jest.fn().mockResolvedValue(localCert);
                        bids = [
                            (0, bid_1.buildRpcBid)({
                                bid: {
                                    id: {
                                        gseq: 1,
                                        provider: selectedProvider.owner
                                    },
                                    state: "active"
                                }
                            })
                        ];
                        return [4 /*yield*/, setupLeaseCreation({
                                bids: bids,
                                genNewCertificateIfLocalIsInvalid: genNewCertificateIfLocalIsInvalid,
                                updateSelectedCertificate: updateSelectedCertificate,
                                signAndBroadcastTx: signAndBroadcastTx,
                                sendManifest: sendManifest,
                                dseq: dseq,
                                selectedProvider: selectedProvider
                            })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(react_1.screen.getByRole("button", { name: /Re-send Manifest/i })).not.toBeDisabled();
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, user_event_1.default.click(react_1.screen.getByRole("button", { name: /Re-send Manifest/i }))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(signAndBroadcastTx).toHaveBeenCalledWith([
                                    expect.objectContaining({
                                        typeUrl: "/".concat(akash_v1_1.MsgCreateCertificate.$type)
                                    })
                                ]);
                                expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
                                    dseq: dseq,
                                    chainNetwork: "mainnet",
                                    credentials: {
                                        type: "mtls",
                                        value: {
                                            cert: localCert.certPem,
                                            key: localCert.keyPem
                                        }
                                    }
                                });
                            })];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setupLeaseCreation(input) {
            return __awaiter(this, void 0, void 0, function () {
                var providers, bids, BidGroup, walletAddress;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            providers = [(_a = input === null || input === void 0 ? void 0 : input.selectedProvider) !== null && _a !== void 0 ? _a : (0, provider_1.buildProvider)(), (0, provider_1.buildProvider)(), (0, provider_1.buildProvider)()];
                            bids = (_b = input === null || input === void 0 ? void 0 : input.bids) !== null && _b !== void 0 ? _b : [
                                (0, bid_1.buildRpcBid)({
                                    bid: {
                                        id: {
                                            gseq: 1,
                                            provider: providers[0].owner
                                        },
                                        state: "open"
                                    }
                                }),
                                (0, bid_1.buildRpcBid)({
                                    bid: {
                                        id: {
                                            gseq: 1,
                                            provider: providers[1].owner
                                        },
                                        state: "open"
                                    }
                                })
                            ];
                            BidGroup = jest.fn(mocks_1.ComponentMock);
                            walletAddress = (_d = (_c = input === null || input === void 0 ? void 0 : input.localCert) === null || _c === void 0 ? void 0 : _c.address) !== null && _d !== void 0 ? _d : "akash123";
                            setup(__assign(__assign({}, input), { bids: bids, BidGroup: BidGroup, walletAddress: walletAddress, localCert: input === null || input === void 0 ? void 0 : input.localCert, providers: providers, storedDeployment: {
                                    manifest: manifest_1.helloWorldManifest,
                                    manifestVersion: new Uint8Array([1, 2, 3]),
                                    name: "test deployment",
                                    owner: walletAddress
                                } }));
                            return [4 /*yield*/, (0, react_1.waitFor)(function () { return expect(BidGroup).toHaveBeenCalled(); })];
                        case 1:
                            _e.sent();
                            (0, react_1.act)(function () {
                                (0, walletUtils_1.updateStorageWallets)([
                                    {
                                        address: walletAddress,
                                        isManaged: false,
                                        name: "test",
                                        selected: true
                                    }
                                ]);
                                var bidGroupProps = BidGroup.mock.calls[0][0];
                                bidGroupProps.handleBidSelected((0, useBidQuery_1.mapToBidDto)(bids[0]));
                            });
                            return [2 /*return*/];
                    }
                });
            });
        }
    });
    function setup(input) {
        var _this = this;
        var _a, _b;
        var favoriteProviders = [];
        var useLocalNotes = (function () { return ({
            favoriteProviders: favoriteProviders
        }); });
        var mockUseFlag = jest.fn(function (flag) {
            if (flag === "anonymous_free_trial") {
                return true;
            }
            return false;
        });
        return (0, react_1.render)(<TestContainerProvider_1.TestContainerProvider services={{
                networkStore: function () {
                    return (0, jest_mock_extended_1.mock)({
                        useSelectedNetworkId: function () { return "mainnet"; }
                    });
                },
                providerProxy: function () {
                    var _a;
                    return (0, jest_mock_extended_1.mock)({
                        sendManifest: (_a = input === null || input === void 0 ? void 0 : input.sendManifest) !== null && _a !== void 0 ? _a : (function () { return Promise.resolve({}); })
                    });
                },
                analyticsService: function () { return (0, jest_mock_extended_1.mock)(); },
                errorHandler: function () { return (0, jest_mock_extended_1.mock)(); },
                chainApiHttpClient: function () {
                    return (0, jest_mock_extended_1.mock)({
                        isFallbackEnabled: !!(input === null || input === void 0 ? void 0 : input.isBlockchainDown),
                        get: function (url) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            var _b;
                            var _c, _d, _e;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        if (url.includes("bids/list")) {
                                            return [2 /*return*/, {
                                                    data: {
                                                        bids: (_c = input === null || input === void 0 ? void 0 : input.bids) !== null && _c !== void 0 ? _c : [],
                                                        pagination: {
                                                            next_key: null,
                                                            total: String((_e = (_d = input === null || input === void 0 ? void 0 : input.bids) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0)
                                                        }
                                                    }
                                                }];
                                        }
                                        if (!url.includes("/blocks/")) return [3 /*break*/, 4];
                                        _b = {};
                                        if (!(input === null || input === void 0 ? void 0 : input.getBlock)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, input.getBlock()];
                                    case 1:
                                        _a = _f.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = (0, block_1.buildBlockDetail)();
                                        _f.label = 3;
                                    case 3: return [2 /*return*/, (_b.data = _a,
                                            _b)];
                                    case 4: throw new Error("unexpected request: ".concat(url));
                                }
                            });
                        }); }
                    });
                },
                publicConsoleApiHttpClient: function () {
                    return (0, jest_mock_extended_1.mock)({
                        get: function (url) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                if (url.includes("/providers")) {
                                    return [2 /*return*/, {
                                            data: (_a = input === null || input === void 0 ? void 0 : input.providers) !== null && _a !== void 0 ? _a : [(0, provider_1.buildProvider)(), (0, provider_1.buildProvider)(), (0, provider_1.buildProvider)()]
                                        }];
                                }
                                throw new Error("unexpected request: ".concat(url));
                            });
                        }); }
                    });
                },
                deploymentLocalStorage: function () {
                    return (0, jest_mock_extended_1.mock)({
                        get: function (walletAddress, dseq) {
                            var _a;
                            if (!walletAddress || !dseq)
                                return null;
                            return ((_a = input === null || input === void 0 ? void 0 : input.storedDeployment) !== null && _a !== void 0 ? _a : {
                                manifest: manifest_1.helloWorldManifest,
                                manifestVersion: new Uint8Array([1, 2, 3]),
                                name: "test deployment",
                                owner: walletAddress
                            });
                        }
                    });
                }
            }}>
        <CreateLease_1.CreateLease dseq={(_a = input === null || input === void 0 ? void 0 : input.dseq) !== null && _a !== void 0 ? _a : "123"} dependencies={__assign(__assign({}, CreateLease_1.DEPENDENCIES), { BidGroup: (_b = input === null || input === void 0 ? void 0 : input.BidGroup) !== null && _b !== void 0 ? _b : mocks_1.ComponentMock, CustomTooltip: mocks_1.ComponentMock, BidCountdownTimer: mocks_1.ComponentMock, useWallet: (function () {
                    var _a, _b, _c;
                    return ({
                        address: (_a = input === null || input === void 0 ? void 0 : input.walletAddress) !== null && _a !== void 0 ? _a : "akash123",
                        walletName: "test",
                        isWalletConnected: true,
                        isWalletLoaded: true,
                        isTrialing: (_b = input === null || input === void 0 ? void 0 : input.isTrialWallet) !== null && _b !== void 0 ? _b : false,
                        signAndBroadcastTx: (_c = input === null || input === void 0 ? void 0 : input.signAndBroadcastTx) !== null && _c !== void 0 ? _c : (function () { return Promise.resolve({}); })
                    });
                }), useCertificate: function () {
                    var _a, _b, _c;
                    return (0, jest_mock_extended_1.mock)({
                        localCert: (_a = input === null || input === void 0 ? void 0 : input.localCert) !== null && _a !== void 0 ? _a : null,
                        genNewCertificateIfLocalIsInvalid: (_b = input === null || input === void 0 ? void 0 : input.genNewCertificateIfLocalIsInvalid) !== null && _b !== void 0 ? _b : (function () { return Promise.resolve(null); }),
                        updateSelectedCertificate: (_c = input === null || input === void 0 ? void 0 : input.updateSelectedCertificate) !== null && _c !== void 0 ? _c : (function (cert) {
                            var _a;
                            return Promise.resolve({
                                certPem: cert.cert,
                                keyPem: cert.privateKey,
                                address: (_a = input === null || input === void 0 ? void 0 : input.walletAddress) !== null && _a !== void 0 ? _a : "akash123"
                            });
                        })
                    });
                }, useLocalNotes: useLocalNotes, useRouter: function () { return (0, jest_mock_extended_1.mock)(); }, useManagedDeploymentConfirm: function () { return ({
                    closeDeploymentConfirm: function () { return Promise.resolve(true); }
                }); }, useSettings: function () {
                    var _a;
                    return ({
                        settings: {
                            apiEndpoint: "https://api.example.com",
                            rpcEndpoint: "https://rpc.example.com",
                            isCustomNode: false,
                            nodes: [],
                            selectedNode: null,
                            customNode: null,
                            isBlockchainDown: (_a = input === null || input === void 0 ? void 0 : input.isBlockchainDown) !== null && _a !== void 0 ? _a : false
                        },
                        setSettings: jest.fn(),
                        isLoadingSettings: false,
                        isSettingsInit: true,
                        refreshNodeStatuses: jest.fn(),
                        isRefreshingNodeStatus: false
                    });
                }, useFlag: function () { return mockUseFlag; } })}/>
      </TestContainerProvider_1.TestContainerProvider>);
    }
});
