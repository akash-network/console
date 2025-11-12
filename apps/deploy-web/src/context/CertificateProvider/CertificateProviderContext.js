"use strict";
"use client";
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
exports.useCertificate = exports.CertificateProvider = exports.DEPENDENCIES = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var notistack_1 = require("notistack");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var walletUtils_1 = require("@src/utils/walletUtils");
var ServicesProvider_1 = require("../ServicesProvider");
var SettingsProvider_1 = require("../SettingsProvider");
var WalletProvider_1 = require("../WalletProvider");
var CertificateProviderContext = react_1.default.createContext({});
exports.DEPENDENCIES = {
    useSettings: SettingsProvider_1.useSettings,
    useWallet: WalletProvider_1.useWallet,
    useSnackbar: notistack_1.useSnackbar,
    useServices: ServicesProvider_1.useServices
};
var CertificateProvider = function (_a) {
    var children = _a.children, _b = _a.dependencies, d = _b === void 0 ? exports.DEPENDENCIES : _b;
    var _c = d.useServices(), certificateManager = _c.certificateManager, analyticsService = _c.analyticsService, certificatesService = _c.certificatesService, errorHandler = _c.errorHandler, chainApiHttpClient = _c.chainApiHttpClient;
    var _d = (0, react_1.useState)(false), isCreatingCert = _d[0], setIsCreatingCert = _d[1];
    var _e = (0, react_1.useState)([]), validCertificates = _e[0], setValidCertificates = _e[1];
    var _f = (0, react_1.useState)(null), selectedCertificate = _f[0], setSelectedCertificate = _f[1];
    var _g = (0, react_1.useState)(false), isLoadingCertificates = _g[0], setIsLoadingCertificates = _g[1];
    var _h = (0, react_1.useState)(null), localCerts = _h[0], setLocalCerts = _h[1];
    var _j = (0, react_1.useState)(null), localCert = _j[0], setLocalCert = _j[1];
    var _k = (0, react_1.useState)(false), isLocalCertMatching = _k[0], setIsLocalCertMatching = _k[1];
    var _l = (0, react_1.useState)(null), parsedLocalCert = _l[0], setParsedLocalCert = _l[1];
    var enqueueSnackbar = d.useSnackbar().enqueueSnackbar;
    var _m = d.useWallet(), address = _m.address, signAndBroadcastTx = _m.signAndBroadcastTx;
    var isSettingsInit = d.useSettings().isSettingsInit;
    var loadValidCertificates = (0, react_1.useCallback)(function (showSnackbar) { return __awaiter(void 0, void 0, void 0, function () {
        var certificates, certs, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsLoadingCertificates(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, certificatesService
                            .getAllCertificates({ address: address, state: "valid" })
                            .catch(function (error) { return (chainApiHttpClient.isFallbackEnabled ? [] : Promise.reject(error)); })];
                case 2:
                    certificates = _a.sent();
                    return [4 /*yield*/, Promise.all((certificates || []).map(function (cert) { return __awaiter(void 0, void 0, void 0, function () {
                            var parsed, pem;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        parsed = atob(cert.certificate.cert);
                                        return [4 /*yield*/, certificateManager.parsePem(parsed)];
                                    case 1:
                                        pem = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, cert), { parsed: parsed, pem: pem })];
                                }
                            });
                        }); }))];
                case 3:
                    certs = _a.sent();
                    setValidCertificates(certs);
                    setIsLoadingCertificates(false);
                    if (showSnackbar) {
                        enqueueSnackbar(<components_1.Snackbar title="Certificate refreshed!" iconVariant="success"/>, { variant: "success" });
                    }
                    return [2 /*return*/, certs];
                case 4:
                    error_1 = _a.sent();
                    errorHandler.reportError({
                        error: error_1,
                        tags: {
                            category: "certificates",
                            action: "loadValidCertificates"
                        }
                    });
                    setIsLoadingCertificates(false);
                    if (showSnackbar) {
                        enqueueSnackbar(<components_1.Snackbar title="Error fetching certificate." iconVariant="error"/>, { variant: "error" });
                    }
                    return [2 /*return*/, []];
                case 5: return [2 /*return*/];
            }
        });
    }); }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, certificatesService, localCert, selectedCertificate]);
    /**
     * When changing wallet, reset certs and load for new wallet
     */
    (0, react_1.useEffect)(function () {
        if (!isSettingsInit || chainApiHttpClient.isFallbackEnabled)
            return;
        setValidCertificates([]);
        setSelectedCertificate(null);
        setLocalCert(null);
        if (address) {
            loadValidCertificates();
            loadLocalCert();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, isSettingsInit, chainApiHttpClient.isFallbackEnabled]);
    (0, react_1.useEffect)(function () {
        var isMatching = false;
        if ((validCertificates === null || validCertificates === void 0 ? void 0 : validCertificates.length) > 0 && localCert) {
            var currentCert = validCertificates.find(function (x) { return x.parsed === localCert.certPem; });
            if (!selectedCertificate && currentCert) {
                setSelectedCertificate(currentCert);
            }
            else {
                currentCert = validCertificates.find(function (x) { return x.parsed === (localCert === null || localCert === void 0 ? void 0 : localCert.certPem) && (selectedCertificate === null || selectedCertificate === void 0 ? void 0 : selectedCertificate.serial) === x.serial; });
            }
            isMatching = !!currentCert;
        }
        setIsLocalCertMatching(isMatching);
    }, [selectedCertificate, localCert, validCertificates]);
    (0, react_1.useEffect)(function () {
        if (!localCert) {
            setParsedLocalCert(null);
            return;
        }
        certificateManager.parsePem(localCert.certPem).then(setParsedLocalCert);
    }, [localCert, certificateManager]);
    var loadLocalCert = function () { return __awaiter(void 0, void 0, void 0, function () {
        var wallets, certs;
        return __generator(this, function (_a) {
            wallets = (0, walletUtils_1.getStorageWallets)();
            certs = wallets.reduce(function (acc, wallet) {
                var cert = wallet.cert && wallet.certKey ? { certPem: wallet.cert, keyPem: wallet.certKey, address: wallet.address } : null;
                if (cert) {
                    acc.push(cert);
                }
                if (wallet.address === address) {
                    setLocalCert(cert);
                }
                return acc;
            }, []);
            setLocalCerts(certs);
            return [2 /*return*/];
        });
    }); };
    /**
     * Create certificate
     */
    function createCertificate() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, crtpem, pubpem, encryptedKey, message, response, validCerts, currentCert, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setIsCreatingCert(true);
                        return [4 /*yield*/, certificateManager.generatePEM(address)];
                    case 1:
                        _a = _b.sent(), crtpem = _a.cert, pubpem = _a.publicKey, encryptedKey = _a.privateKey;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 6, , 7]);
                        message = TransactionMessageData_1.TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem);
                        return [4 /*yield*/, signAndBroadcastTx([message])];
                    case 3:
                        response = _b.sent();
                        if (!response) return [3 /*break*/, 5];
                        (0, walletUtils_1.updateWallet)(address, function (wallet) {
                            return __assign(__assign({}, wallet), { cert: crtpem, certKey: encryptedKey });
                        });
                        return [4 /*yield*/, loadValidCertificates()];
                    case 4:
                        validCerts = _b.sent();
                        loadLocalCert();
                        currentCert = validCerts.find(function (_a) {
                            var parsed = _a.parsed;
                            return parsed === crtpem;
                        }) || null;
                        setSelectedCertificate(currentCert);
                        analyticsService.track("create_certificate", {
                            category: "certificates",
                            label: "Created certificate"
                        });
                        _b.label = 5;
                    case 5:
                        setIsCreatingCert(false);
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _b.sent();
                        setIsCreatingCert(false);
                        throw error_2;
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Regenerate certificate
     */
    function regenerateCertificate() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, crtpem, pubpem, encryptedKey, revokeCertMsg, createCertMsg, response, validCerts, currentCert, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        setIsCreatingCert(true);
                        return [4 /*yield*/, certificateManager.generatePEM(address)];
                    case 1:
                        _a = _b.sent(), crtpem = _a.cert, pubpem = _a.publicKey, encryptedKey = _a.privateKey;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 6, , 7]);
                        revokeCertMsg = TransactionMessageData_1.TransactionMessageData.getRevokeCertificateMsg(address, selectedCertificate === null || selectedCertificate === void 0 ? void 0 : selectedCertificate.serial);
                        createCertMsg = TransactionMessageData_1.TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem);
                        return [4 /*yield*/, signAndBroadcastTx([revokeCertMsg, createCertMsg])];
                    case 3:
                        response = _b.sent();
                        if (!response) return [3 /*break*/, 5];
                        (0, walletUtils_1.updateWallet)(address, function (wallet) {
                            return __assign(__assign({}, wallet), { cert: crtpem, certKey: encryptedKey });
                        });
                        return [4 /*yield*/, loadValidCertificates()];
                    case 4:
                        validCerts = _b.sent();
                        loadLocalCert();
                        currentCert = validCerts.find(function (x) { return x.parsed === crtpem; });
                        setSelectedCertificate(currentCert);
                        analyticsService.track("regenerate_certificate", {
                            category: "certificates",
                            label: "Regenerated certificate"
                        });
                        _b.label = 5;
                    case 5:
                        setIsCreatingCert(false);
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _b.sent();
                        setIsCreatingCert(false);
                        throw error_3;
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Revoke certificate
     */
    var revokeCertificate = function (certificate) { return __awaiter(void 0, void 0, void 0, function () {
        var message, response, validCerts, isRevokingOtherCert_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    message = TransactionMessageData_1.TransactionMessageData.getRevokeCertificateMsg(address, certificate.serial);
                    return [4 /*yield*/, signAndBroadcastTx([message])];
                case 1:
                    response = _a.sent();
                    if (!response) return [3 /*break*/, 3];
                    return [4 /*yield*/, loadValidCertificates()];
                case 2:
                    validCerts = _a.sent();
                    isRevokingOtherCert_1 = validCerts.some(function (c) { return c.parsed === (localCert === null || localCert === void 0 ? void 0 : localCert.certPem); });
                    (0, walletUtils_1.updateWallet)(address, function (wallet) {
                        return __assign(__assign({}, wallet), { cert: isRevokingOtherCert_1 ? wallet.cert : undefined, certKey: isRevokingOtherCert_1 ? wallet.certKey : undefined });
                    });
                    if ((validCerts === null || validCerts === void 0 ? void 0 : validCerts.length) > 0 && certificate.serial === (selectedCertificate === null || selectedCertificate === void 0 ? void 0 : selectedCertificate.serial)) {
                        setSelectedCertificate(validCerts[0]);
                    }
                    else if ((validCerts === null || validCerts === void 0 ? void 0 : validCerts.length) === 0) {
                        setSelectedCertificate(null);
                    }
                    analyticsService.track("revoke_certificate", {
                        category: "certificates",
                        label: "Revoked certificate"
                    });
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    /**
     * Revoke all certificates
     */
    var revokeAllCertificates = function () { return __awaiter(void 0, void 0, void 0, function () {
        var messages, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    messages = validCertificates.map(function (cert) { return TransactionMessageData_1.TransactionMessageData.getRevokeCertificateMsg(address, cert.serial); });
                    return [4 /*yield*/, signAndBroadcastTx(messages)];
                case 1:
                    response = _a.sent();
                    if (!response) return [3 /*break*/, 3];
                    return [4 /*yield*/, loadValidCertificates()];
                case 2:
                    _a.sent();
                    (0, walletUtils_1.updateWallet)(address, function (wallet) {
                        return __assign(__assign({}, wallet), { cert: undefined, certKey: undefined });
                    });
                    setSelectedCertificate(null);
                    analyticsService.track("revoke_all_certificates", {
                        category: "certificates",
                        label: "Revoked all certificates"
                    });
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var genNewCertificateIfLocalIsInvalid = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var validCerts, currentCert, isLocalCertValid, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(!parsedLocalCert || isExpired(parsedLocalCert))) return [3 /*break*/, 2];
                    return [4 /*yield*/, certificateManager.generatePEM(address)];
                case 1: return [2 /*return*/, _c.sent()];
                case 2: return [4 /*yield*/, loadValidCertificates()];
                case 3:
                    validCerts = _c.sent();
                    currentCert = localCert ? validCerts.find(function (_a) {
                        var parsed = _a.parsed;
                        return parsed === localCert.certPem;
                    }) : null;
                    isLocalCertValid = ((_b = currentCert === null || currentCert === void 0 ? void 0 : currentCert.certificate) === null || _b === void 0 ? void 0 : _b.state) === "valid" && isLocalCertMatching;
                    if (!isLocalCertValid) return [3 /*break*/, 4];
                    _a = null;
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, certificateManager.generatePEM(address)];
                case 5:
                    _a = _c.sent();
                    _c.label = 6;
                case 6: return [2 /*return*/, _a];
            }
        });
    }); }, [localCert, loadValidCertificates, isLocalCertMatching, address, parsedLocalCert, certificateManager]);
    var updateSelectedCertificate = (0, react_1.useCallback)(function (cert) { return __awaiter(void 0, void 0, void 0, function () {
        var validCerts, currentCert;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, walletUtils_1.updateWallet)(address, function (wallet) {
                        return __assign(__assign({}, wallet), { cert: cert.cert, certKey: cert.privateKey });
                    });
                    return [4 /*yield*/, loadValidCertificates()];
                case 1:
                    validCerts = _a.sent();
                    loadLocalCert();
                    currentCert = validCerts.find(function (x) { return x.parsed === cert.cert; });
                    setSelectedCertificate(currentCert || null);
                    return [2 /*return*/, {
                            certPem: cert.cert,
                            keyPem: cert.privateKey,
                            address: address
                        }];
            }
        });
    }); }, [address, loadValidCertificates, loadLocalCert, setSelectedCertificate]);
    return (<CertificateProviderContext.Provider value={{
            loadValidCertificates: loadValidCertificates,
            selectedCertificate: selectedCertificate,
            setSelectedCertificate: setSelectedCertificate,
            isLoadingCertificates: isLoadingCertificates,
            loadLocalCert: loadLocalCert,
            get localCert() {
                return !parsedLocalCert || isExpired(parsedLocalCert) ? null : localCert;
            },
            setLocalCert: setLocalCert,
            get isLocalCertExpired() {
                return !!parsedLocalCert && isExpired(parsedLocalCert);
            },
            genNewCertificateIfLocalIsInvalid: genNewCertificateIfLocalIsInvalid,
            updateSelectedCertificate: updateSelectedCertificate,
            isLocalCertMatching: isLocalCertMatching,
            validCertificates: validCertificates,
            setValidCertificates: setValidCertificates,
            localCerts: localCerts,
            setLocalCerts: setLocalCerts,
            createCertificate: createCertificate,
            isCreatingCert: isCreatingCert,
            regenerateCertificate: regenerateCertificate,
            revokeCertificate: revokeCertificate,
            revokeAllCertificates: revokeAllCertificates
        }}>
      {children}
    </CertificateProviderContext.Provider>);
};
exports.CertificateProvider = CertificateProvider;
var useCertificate = function () {
    return __assign({}, react_1.default.useContext(CertificateProviderContext));
};
exports.useCertificate = useCertificate;
function isExpired(parsedLocalCert) {
    return parsedLocalCert.expiresOn.getTime() <= Date.now();
}
