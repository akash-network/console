"use strict";
"use client";
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
exports.useProviderApiActions = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var notistack_1 = require("notistack");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useProviderCredentials_1 = require("@src/hooks/useProviderCredentials/useProviderCredentials");
var networkStore_1 = require("@src/store/networkStore");
// TODO: ideally this should be merged together with useProviderWebsocket hook
// but it depends on useWebsocket hook which immediately connects the websocket
// and we don't want to connect the websocket unnecessarily
var useProviderApiActions = function () {
    var providerCredentials = (0, useProviderCredentials_1.useProviderCredentials)();
    var _a = (0, notistack_1.useSnackbar)(), enqueueSnackbar = _a.enqueueSnackbar, closeSnackbar = _a.closeSnackbar;
    var chainNetwork = networkStore_1.default.useSelectedNetworkId();
    var _b = (0, ServicesProvider_1.useServices)(), providerProxy = _b.providerProxy, logger = _b.logger;
    var showSnackbar = (0, react_1.useCallback)(function (title) {
        var abortController = new AbortController();
        var snackbarKey = enqueueSnackbar(<components_1.Snackbar title={title} subTitle={<components_1.Button onClick={function () { return abortController.abort(); }} variant="text" size="sm">
              Cancel
            </components_1.Button>} showLoading/>, { variant: "info", persist: true, action: function () { return null; } });
        return { snackbarKey: snackbarKey, abortController: abortController };
    }, [enqueueSnackbar]);
    var displayResult = (0, react_1.useCallback)(function (errorMessage, result) {
        if (!result.ok && result.code !== "cancelled") {
            var message = result.message ? "".concat(errorMessage, ":\n").concat(result.message) : errorMessage;
            enqueueSnackbar(message, { variant: "error" });
        }
    }, [enqueueSnackbar]);
    var downloadLogs = (0, react_1.useCallback)(function (provider, dseq, gseq, oseq, isLogs) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, snackbarKey, abortController, result, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = showSnackbar(isLogs ? "Downloading logs..." : "Downloading events..."), snackbarKey = _a.snackbarKey, abortController = _a.abortController;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, providerProxy.downloadLogs({
                            providerBaseUrl: provider.hostUri,
                            providerAddress: provider.owner,
                            providerCredentials: providerCredentials.details,
                            chainNetwork: chainNetwork,
                            dseq: dseq,
                            gseq: gseq,
                            oseq: oseq,
                            type: isLogs ? "logs" : "events",
                            signal: abortController.signal
                        })];
                case 2:
                    result = _b.sent();
                    displayResult(isLogs ? "Failed to download logs" : "Failed to download events", result);
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _b.sent();
                    logger.error({ event: "DOWNLOAD_LOGS_ERROR", error: error_1 });
                    displayResult(isLogs ? "Failed to download logs" : "Failed to download events", {
                        ok: false,
                        code: "unknown",
                        message: "Unexpected error. Could not connect to provider."
                    });
                    return [3 /*break*/, 5];
                case 4:
                    closeSnackbar(snackbarKey);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [providerCredentials.details, chainNetwork, providerProxy, showSnackbar, closeSnackbar, displayResult]);
    var downloadFileFromShell = (0, react_1.useCallback)(function (provider, dseq, gseq, oseq, service, filePath) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, snackbarKey, abortController, result, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = showSnackbar("Downloading ".concat(filePath, "...")), snackbarKey = _a.snackbarKey, abortController = _a.abortController;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, providerProxy.downloadFileFromShell({
                            providerBaseUrl: provider.hostUri,
                            providerAddress: provider.owner,
                            providerCredentials: providerCredentials.details,
                            chainNetwork: chainNetwork,
                            dseq: dseq,
                            gseq: gseq,
                            oseq: oseq,
                            service: service,
                            filePath: filePath,
                            signal: abortController.signal
                        })];
                case 2:
                    result = _b.sent();
                    displayResult("Failed to download file from shell", result);
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _b.sent();
                    logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: error_2 });
                    displayResult("Failed to download file from shell", {
                        ok: false,
                        code: "unknown",
                        message: "Unexpected error. Could not connect to provider."
                    });
                    return [3 /*break*/, 5];
                case 4:
                    closeSnackbar(snackbarKey);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [providerCredentials.details, chainNetwork, providerProxy, showSnackbar, closeSnackbar, displayResult]);
    return (0, react_1.useMemo)(function () { return ({
        downloadLogs: downloadLogs,
        downloadFileFromShell: downloadFileFromShell
    }); }, [downloadLogs, downloadFileFromShell]);
};
exports.useProviderApiActions = useProviderApiActions;
