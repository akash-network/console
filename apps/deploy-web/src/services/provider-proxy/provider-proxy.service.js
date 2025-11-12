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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderProxyService = exports.WS_ERRORS = void 0;
exports.providerCredentialsToApiCredentials = providerCredentialsToApiCredentials;
var net_1 = require("@akashnetwork/net");
var file_saver_1 = require("file-saver");
var WebsocketSession_1 = require("@src/lib/websocket/WebsocketSession");
var timer_1 = require("@src/utils/timer");
var logFormatters_1 = require("./logFormatters");
// @see https://www.rfc-editor.org/rfc/rfc6455.html#page-46
exports.WS_ERRORS = {
    VIOLATED_POLICY: 1008
};
var ProviderProxyService = /** @class */ (function () {
    function ProviderProxyService(axios, logger, createWebSocket, saveFile, netConfig) {
        if (saveFile === void 0) { saveFile = file_saver_1.default; }
        if (netConfig === void 0) { netConfig = new net_1.NetConfig(); }
        this.axios = axios;
        this.logger = logger;
        this.createWebSocket = createWebSocket;
        this.saveFile = saveFile;
        this.netConfig = netConfig;
    }
    ProviderProxyService.prototype.request = function (url, options) {
        var chainNetwork = options.chainNetwork, providerIdentity = options.providerIdentity, timeout = options.timeout, credentials = options.credentials, params = __rest(options, ["chainNetwork", "providerIdentity", "timeout", "credentials"]);
        return this.axios.post("/", __assign(__assign({}, params), { method: options.method || "GET", url: providerIdentity.hostUri + url, providerAddress: providerIdentity.owner, network: this.netConfig.mapped(options.chainNetwork), auth: credentials ? providerCredentialsToApiCredentials(credentials) : undefined }), { timeout: timeout });
    };
    ProviderProxyService.prototype.sendManifest = function (providerInfo, manifest, options) {
        return __awaiter(this, void 0, void 0, function () {
            var jsonStr, response, i, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!providerInfo)
                            return [2 /*return*/];
                        this.logger.info({ event: "START_SEND_MANIFEST", providerAddress: providerInfo.owner, dseq: options.dseq });
                        jsonStr = JSON.stringify(manifest, function (_, value) {
                            if (typeof value !== "object" || value === null || !("quantity" in value))
                                return value;
                            var quantity = value.quantity, rest = __rest(value, ["quantity"]);
                            if (typeof quantity !== "object" || quantity === null || !("val" in quantity))
                                return value;
                            return __assign(__assign({}, rest), { size: quantity });
                        });
                        // Waiting for provider to have lease
                        return [4 /*yield*/, (0, timer_1.wait)(ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY)];
                    case 1:
                        // Waiting for provider to have lease
                        _a.sent();
                        i = 1;
                        _a.label = 2;
                    case 2:
                        if (!(i <= 3 && !response)) return [3 /*break*/, 11];
                        this.logger.info({ event: "ATTEMPT_SEND_MANIFEST", attempt: i, providerAddress: providerInfo.owner, dseq: options.dseq });
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 6, , 10]);
                        if (!!response) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.request("/deployment/".concat(options.dseq, "/manifest"), {
                                method: "PUT",
                                credentials: options.credentials,
                                body: jsonStr,
                                timeout: 60000,
                                providerIdentity: providerInfo,
                                chainNetwork: options.chainNetwork
                            })];
                    case 4:
                        response = _a.sent();
                        this.logger.info({ event: "SEND_MANIFEST_SUCCESS", response: response, providerAddress: providerInfo.owner, dseq: options.dseq });
                        _a.label = 5;
                    case 5: return [3 /*break*/, 10];
                    case 6:
                        err_1 = _a.sent();
                        if (!(typeof err_1 === "string" && err_1.indexOf("no lease for deployment") !== -1 && i < 3)) return [3 /*break*/, 8];
                        this.logger.info({
                            event: "LEASE_NOT_FOUND",
                            error: err_1,
                            message: "Lease not found, retrying...",
                            providerAddress: providerInfo.owner,
                            dseq: options.dseq
                        });
                        return [4 /*yield*/, (0, timer_1.wait)(ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY + 1000)];
                    case 7:
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        this.logger.error({ event: "SEND_MANIFEST_ERROR", error: err_1, providerAddress: providerInfo.owner, dseq: options.dseq });
                        throw err_1;
                    case 9: return [3 /*break*/, 10];
                    case 10:
                        i++;
                        return [3 /*break*/, 2];
                    case 11: 
                    // Waiting for provider to boot up workload
                    return [4 /*yield*/, (0, timer_1.wait)(5000)];
                    case 12:
                        // Waiting for provider to boot up workload
                        _a.sent();
                        return [2 /*return*/, response];
                }
            });
        });
    };
    ProviderProxyService.prototype.downloadLogs = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var abortController, logsStream, abortTimerId, scheduleAbortTimeout, logFileContent, _a, logsStream_1, logsStream_1_1, logEntry, logMessage, e_1_1, fileName;
            var _b, e_1, _c, _d;
            var _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        abortController = new AbortController();
                        logsStream = this.getLogsStream(__assign(__assign({}, input), { follow: false, tail: 10000000, signal: input.signal ? AbortSignal.any([abortController.signal, input.signal]) : abortController.signal }));
                        scheduleAbortTimeout = function () {
                            if (abortTimerId)
                                clearTimeout(abortTimerId);
                            abortTimerId = setTimeout(function () { return abortController.abort(); }, 3000);
                        };
                        scheduleAbortTimeout();
                        logFileContent = "";
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 6, 7, 12]);
                        _a = true, logsStream_1 = __asyncValues(logsStream);
                        _f.label = 2;
                    case 2: return [4 /*yield*/, logsStream_1.next()];
                    case 3:
                        if (!(logsStream_1_1 = _f.sent(), _b = logsStream_1_1.done, !_b)) return [3 /*break*/, 5];
                        _d = logsStream_1_1.value;
                        _a = false;
                        logEntry = _d;
                        scheduleAbortTimeout();
                        if (logEntry.closed) {
                            clearTimeout(abortTimerId);
                            return [3 /*break*/, 5];
                        }
                        if (!logEntry.message)
                            return [3 /*break*/, 4];
                        logMessage = input.type === "logs" ? (0, logFormatters_1.formatLogMessage)(logEntry.message) : (0, logFormatters_1.formatK8sEvent)(logEntry.message);
                        logFileContent += logMessage + "\n";
                        _f.label = 4;
                    case 4:
                        _a = true;
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 12];
                    case 6:
                        e_1_1 = _f.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 12];
                    case 7:
                        _f.trys.push([7, , 10, 11]);
                        if (!(!_a && !_b && (_c = logsStream_1.return))) return [3 /*break*/, 9];
                        return [4 /*yield*/, _c.call(logsStream_1)];
                    case 8:
                        _f.sent();
                        _f.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 11: return [7 /*endfinally*/];
                    case 12:
                        if ((_e = input.signal) === null || _e === void 0 ? void 0 : _e.aborted) {
                            return [2 /*return*/, { ok: false, code: "cancelled" }];
                        }
                        if (logFileContent) {
                            fileName = "".concat(input.dseq, "-").concat(input.gseq, "-").concat(input.oseq, "-").concat(input.type, "-").concat(new Date().toISOString().substring(0, 10), ".txt");
                            this.saveFile(new Blob([logFileContent], { type: "text/plain" }), fileName);
                            return [2 /*return*/, { ok: true }];
                        }
                        return [2 /*return*/, { ok: false, code: "unknown", message: "No log content received from server" }];
                }
            });
        });
    };
    ProviderProxyService.prototype.downloadFileFromShell = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var printCommand, session, textDecoder, fileContent, exitCode, errorMessage, _a, _b, _c, message, bufferData, stringData, jsonData, newFileContent, e_2_1, fileName;
            var _d, e_2, _e, _f;
            var _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        printCommand = "cat";
                        session = this.connectToShell(__assign(__assign({}, input), { command: "".concat(printCommand, " ").concat(input.filePath) }));
                        session.send(new Uint8Array());
                        textDecoder = new TextDecoder("utf-8");
                        fileContent = null;
                        errorMessage = "";
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 6, 7, 12]);
                        _a = true, _b = __asyncValues(session.receive());
                        _j.label = 2;
                    case 2: return [4 /*yield*/, _b.next()];
                    case 3:
                        if (!(_c = _j.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                        _f = _c.value;
                        _a = false;
                        message = _f;
                        if (!((_g = message.message) === null || _g === void 0 ? void 0 : _g.data))
                            return [3 /*break*/, 4];
                        bufferData = new Uint8Array(message.message.data.slice(1));
                        stringData = textDecoder.decode(bufferData).trim();
                        if (stringData[0] === "{" && stringData[stringData.length - 1] === "}" && stringData.includes('"exit_code"')) {
                            try {
                                jsonData = JSON.parse(stringData);
                                exitCode = jsonData["exit_code"];
                                errorMessage = jsonData["message"];
                            }
                            catch (_k) {
                                // empty
                            }
                        }
                        if (exitCode !== undefined) {
                            if (exitCode !== 0) {
                                errorMessage = fileContent ? textDecoder.decode(fileContent).trim() : "Did not receive file content from server";
                                fileContent = null;
                                this.logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: errorMessage });
                            }
                            else if (fileContent) {
                                this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_SUCCESS", length: fileContent.length });
                            }
                            session.disconnect();
                            return [3 /*break*/, 5];
                        }
                        if (!fileContent) {
                            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_INIT" });
                            fileContent = bufferData;
                        }
                        else {
                            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_APPEND", length: fileContent.length });
                            newFileContent = new Uint8Array(fileContent.length + bufferData.length);
                            newFileContent.set(fileContent, 0);
                            newFileContent.set(bufferData, fileContent.length);
                            fileContent = newFileContent;
                        }
                        _j.label = 4;
                    case 4:
                        _a = true;
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 12];
                    case 6:
                        e_2_1 = _j.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 12];
                    case 7:
                        _j.trys.push([7, , 10, 11]);
                        if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 9];
                        return [4 /*yield*/, _e.call(_b)];
                    case 8:
                        _j.sent();
                        _j.label = 9;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        if (e_2) throw e_2.error;
                        return [7 /*endfinally*/];
                    case 11: return [7 /*endfinally*/];
                    case 12:
                        if ((_h = input.signal) === null || _h === void 0 ? void 0 : _h.aborted) {
                            return [2 /*return*/, { ok: false, code: "cancelled" }];
                        }
                        if (fileContent) {
                            this.logger.info({ event: "DOWNLOAD_FILE_FROM_SHELL_SUCCESS" });
                            fileName = input.filePath.replace(/^.*[\\/]/, "");
                            this.saveFile(new Blob([fileContent]), fileName);
                            return [2 /*return*/, { ok: true }];
                        }
                        if (errorMessage) {
                            this.logger.error({ event: "DOWNLOAD_FILE_FROM_SHELL_ERROR", error: errorMessage });
                            return [2 /*return*/, { ok: false, code: "unknown", message: errorMessage }];
                        }
                        return [2 /*return*/, { ok: false, code: "unknown", message: "No file content received from server" }];
                }
            });
        });
    };
    ProviderProxyService.prototype.getLogsStream = function (input) {
        return __asyncGenerator(this, arguments, function getLogsStream_1() {
            var tail, url, session;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tail = input.tail ? "&tail=".concat(input.tail) : "";
                        url = "".concat(providerLeaseUrl(input), "?follow=").concat(input.follow ? "true" : "false").concat(tail).concat(input.services ? "&service=".concat(input.services.join(",")) : "");
                        session = new WebsocketSession_1.WebsocketSession({
                            websocketFactory: this.createWebSocket,
                            shouldRetry: function (error) { return !error.cause || !isInvalidProviderCertificate(error.cause); },
                            signal: input.signal,
                            transformSentMessage: function () {
                                return JSON.stringify({
                                    type: "websocket",
                                    url: url,
                                    auth: providerCredentialsToApiCredentials(input.providerCredentials),
                                    chainNetwork: _this.netConfig.mapped(input.chainNetwork),
                                    providerAddress: input.providerAddress
                                });
                            },
                            transformReceivedMessage: function (rawMessage) {
                                var message = JSON.parse(rawMessage);
                                if (!message.message)
                                    return message;
                                return __assign(__assign({}, message), { message: JSON.parse(message.message) });
                            }
                        });
                        session.send(undefined);
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(session.receive())))];
                    case 1: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 2: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ProviderProxyService.prototype.connectToShell = function (input) {
        var _this = this;
        var command = (input.command || "/bin/sh")
            .split(" ")
            .map(function (c, i) { return "&cmd".concat(i, "=").concat(encodeURIComponent(c.replace(" ", "+"))); })
            .join("");
        var url = "".concat(providerLeaseUrl(__assign(__assign({}, input), { type: "shell" })), "?stdin=").concat(input.useStdIn ? "1" : "0", "&tty=").concat(input.useTTY ? "1" : "0", "&podIndex=0&").concat(command, "&service=").concat(encodeURIComponent(input.service));
        return new WebsocketSession_1.WebsocketSession({
            websocketFactory: this.createWebSocket,
            shouldRetry: function (error) { return !error.cause || !isInvalidProviderCertificate(error.cause); },
            signal: input.signal,
            transformSentMessage: function (message) {
                var remoteMessage = {
                    type: "websocket",
                    url: url,
                    auth: providerCredentialsToApiCredentials(input.providerCredentials),
                    chainNetwork: _this.netConfig.mapped(input.chainNetwork),
                    providerAddress: input.providerAddress
                };
                if (message.length > 0) {
                    remoteMessage.data = message.toString();
                }
                return JSON.stringify(remoteMessage);
            }
        });
    };
    ProviderProxyService.BEFORE_SEND_MANIFEST_DELAY = 5000;
    return ProviderProxyService;
}());
exports.ProviderProxyService = ProviderProxyService;
function providerLeaseUrl(input) {
    var type = input.type === "events" ? "kubeevents" : input.type;
    return "".concat(input.providerBaseUrl, "/lease/").concat(input.dseq, "/").concat(input.gseq, "/").concat(input.oseq, "/").concat(type);
}
function providerCredentialsToApiCredentials(credentials) {
    if (!(credentials === null || credentials === void 0 ? void 0 : credentials.value))
        return;
    if (credentials.type === "mtls")
        return {
            type: credentials.type,
            certPem: credentials.value.cert,
            keyPem: credentials.value.key
        };
    return {
        type: credentials.type,
        token: credentials.value
    };
}
function isInvalidProviderCertificate(event) {
    return "code" in event && "reason" in event && event.code === exports.WS_ERRORS.VIOLATED_POLICY && event.reason.startsWith("invalidCertificate.");
}
