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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var jest_mock_extended_1 = require("jest-mock-extended");
var provider_proxy_service_1 = require("./provider-proxy.service");
var seeders_1 = require("@tests/seeders");
var websocketMock_1 = require("@tests/unit/websocketMock");
describe(provider_proxy_service_1.ProviderProxyService.name, function () {
    afterEach(function () {
        jest.useRealTimers();
    });
    describe("sendManifest", function () {
        it("does nothing if provider is undefined", function () {
            var _a = setup(), service = _a.service, httpClient = _a.httpClient;
            service.sendManifest(undefined, {}, { dseq: "1", chainNetwork: "akash" });
            expect(httpClient.post).not.toHaveBeenCalled();
        });
        it("sends manifest to provider", function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, httpClient, service, provider, dseq, manifest, credentials, promise, result;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        jest.useFakeTimers();
                        response = {};
                        httpClient = (0, jest_mock_extended_1.mock)({
                            post: jest.fn().mockResolvedValue(response)
                        });
                        service = setup({ httpClient: httpClient }).service;
                        provider = (0, seeders_1.buildProvider)();
                        dseq = "1";
                        manifest = [
                            {
                                profiles: {
                                    compute: {
                                        web: {
                                            resources: {
                                                cpu: {
                                                    units: {
                                                        val: "0.5"
                                                    }
                                                }
                                            },
                                            memory: {
                                                quantity: {
                                                    val: "512Mi"
                                                }
                                            },
                                            storage: {
                                                quantity: {
                                                    val: "512Mi"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ];
                        credentials = { type: "mtls", value: { cert: "certPem", key: "keyPem" } };
                        promise = service.sendManifest(provider, manifest, { dseq: dseq, chainNetwork: "mainnet", credentials: credentials });
                        return [4 /*yield*/, Promise.all([promise, jest.runAllTimersAsync()])];
                    case 1:
                        result = (_c.sent())[0];
                        expect(httpClient.post).toHaveBeenCalledWith("/", {
                            method: "PUT",
                            url: "".concat(provider.hostUri, "/deployment/").concat(dseq, "/manifest"),
                            providerAddress: provider.owner,
                            network: "mainnet",
                            auth: {
                                type: "mtls",
                                certPem: (_a = credentials.value) === null || _a === void 0 ? void 0 : _a.cert,
                                keyPem: (_b = credentials.value) === null || _b === void 0 ? void 0 : _b.key
                            },
                            body: JSON.stringify([
                                {
                                    profiles: {
                                        compute: {
                                            web: {
                                                resources: {
                                                    cpu: {
                                                        units: {
                                                            val: "0.5"
                                                        }
                                                    }
                                                },
                                                memory: {
                                                    size: {
                                                        val: "512Mi"
                                                    }
                                                },
                                                storage: {
                                                    size: {
                                                        val: "512Mi"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            ])
                        }, { timeout: expect.any(Number) });
                        expect(result).toBe(response);
                        jest.useRealTimers();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("downloadLogs", function () {
        it("downloads logs successfully and saves file", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, logMessages, _i, logMessages_1, message, result, savedBlob, savedContent;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            type: "logs",
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            chainNetwork: "mainnet",
                            dseq: "123",
                            gseq: 1,
                            oseq: 1
                        };
                        promise = service.downloadLogs(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        logMessages = [
                            {
                                name: "web-service-abc123",
                                message: "Server started on port 8080",
                                service: "web"
                            },
                            {
                                name: "web-service-abc123",
                                message: "Database connected",
                                service: "web"
                            }
                        ];
                        _i = 0, logMessages_1 = logMessages;
                        _b.label = 2;
                    case 2:
                        if (!(_i < logMessages_1.length)) return [3 /*break*/, 5];
                        message = logMessages_1[_i];
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({
                                    message: JSON.stringify(message)
                                })
                            }))];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 7:
                        result = _b.sent();
                        expect(result).toEqual({ ok: true });
                        expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/123-1-1-logs-\d{4}-\d{2}-\d{2}\.txt/));
                        savedBlob = saveFile.mock.calls[0][0];
                        return [4 /*yield*/, savedBlob.text()];
                    case 8:
                        savedContent = _b.sent();
                        expect(savedContent).toContain("[web]: Server started on port 8080");
                        expect(savedContent).toContain("[web]: Database connected");
                        return [2 /*return*/];
                }
            });
        }); });
        it("downloads events successfully and saves file", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, eventMessage, result, savedBlob, savedContent;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "456",
                            gseq: 2,
                            oseq: 3,
                            type: "events",
                            chainNetwork: "testnet"
                        };
                        promise = service.downloadLogs(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        eventMessage = JSON.stringify({
                            message: JSON.stringify({
                                type: "Normal",
                                reason: "Started",
                                object: { name: "web-pod-abc", kind: "Pod", namespace: "default" },
                                note: "Container started successfully",
                                message: "Container started successfully",
                                service: "web",
                                reportingController: "web-controller",
                                reportingInstance: "web-instance"
                            })
                        });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: eventMessage }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 4:
                        result = _b.sent();
                        expect(result).toEqual({ ok: true });
                        expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/456-2-3-events-\d{4}-\d{2}-\d{2}\.txt/));
                        savedBlob = saveFile.mock.calls[0][0];
                        return [4 /*yield*/, savedBlob.text()];
                    case 5:
                        savedContent = _b.sent();
                        expect(savedContent).toContain("[web]: [Normal] [Started] [Pod] Container started successfully");
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles cancellation via AbortSignal", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, abortController, input, promise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        abortController = new AbortController();
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "jwt", value: "token123" },
                            dseq: "789",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet",
                            signal: abortController.signal
                        };
                        promise = service.downloadLogs(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        abortController.abort();
                        return [4 /*yield*/, promise];
                    case 2:
                        result = _b.sent();
                        expect(result).toEqual({ ok: false, code: "cancelled" });
                        expect(saveFile).not.toHaveBeenCalled();
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("stops downloading logs when closed message is received", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, result, savedBlob, savedContent;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "111",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet"
                        };
                        promise = service.downloadLogs(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({
                                    message: JSON.stringify({
                                        name: "web-service-abc123",
                                        message: "Server started on port 8080",
                                        service: "web"
                                    })
                                })
                            }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({ closed: true })
                            }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 4:
                        result = _b.sent();
                        expect(result).toEqual({ ok: true });
                        savedBlob = saveFile.mock.calls[0][0];
                        return [4 /*yield*/, savedBlob.text()];
                    case 5:
                        savedContent = _b.sent();
                        expect(savedContent).toBe("[web]: Server started on port 8080\n");
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles WebSocket close without finishing", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "222",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet"
                        };
                        promise = service.downloadLogs(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        // Close WebSocket immediately without finishing
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 2:
                        // Close WebSocket immediately without finishing
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 3:
                        result = _b.sent();
                        expect(result).toEqual({ ok: false, code: "unknown", message: expect.any(String) });
                        expect(saveFile).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("aborts download after 3 seconds if no messages are received", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, promise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        jest.useFakeTimers();
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "111",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet"
                        };
                        promise = service.downloadLogs(input);
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(3001)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 3:
                        result = _b.sent();
                        expect(result).toEqual({
                            ok: false,
                            code: "unknown",
                            message: expect.stringMatching(/No log content received from server/i)
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("downloadFileFromShell", function () {
        it("downloads file successfully and saves it", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, fileContent, encoder, contentBytes, message1, message2, result, savedBlob, savedContent;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "123",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            filePath: "/app/config.json"
                        };
                        promise = service.downloadFileFromShell(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        fileContent = '{"setting": "value"}';
                        encoder = new TextEncoder();
                        contentBytes = encoder.encode(fileContent);
                        message1 = JSON.stringify({
                            message: { data: __spreadArray([100], contentBytes, true) }
                        });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: message1 }))];
                    case 2:
                        _b.sent();
                        message2 = JSON.stringify({
                            message: { data: __spreadArray([0], encoder.encode('{"exit_code": 0}'), true) }
                        });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: message2 }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 5:
                        result = _b.sent();
                        expect(result).toEqual({ ok: true });
                        expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "config.json");
                        savedBlob = saveFile.mock.calls[0][0];
                        return [4 /*yield*/, savedBlob.text()];
                    case 6:
                        savedContent = _b.sent();
                        expect(savedContent).toBe(fileContent);
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles file download with multiple chunks", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, encoder, chunks, _i, chunks_1, chunk, result, savedBlob, savedContent;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "456",
                            gseq: 2,
                            oseq: 3,
                            chainNetwork: "testnet",
                            service: "api",
                            filePath: "/data/largefile.txt"
                        };
                        promise = service.downloadFileFromShell(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        encoder = new TextEncoder();
                        chunks = ["First chunk ", "Second chunk ", "Third chunk", "{\"exit_code\": 0}"];
                        _i = 0, chunks_1 = chunks;
                        _b.label = 2;
                    case 2:
                        if (!(_i < chunks_1.length)) return [3 /*break*/, 5];
                        chunk = chunks_1[_i];
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({ message: { data: __spreadArray([0], encoder.encode(chunk), true) } })
                            }))];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 7:
                        result = _b.sent();
                        expect(result).toEqual({ ok: true });
                        savedBlob = saveFile.mock.calls[0][0];
                        return [4 /*yield*/, savedBlob.text()];
                    case 8:
                        savedContent = _b.sent();
                        expect(savedContent).toBe("First chunk Second chunk Third chunk");
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when exit code is non-zero", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, encoder, errorContent, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "jwt", value: "token123" },
                            dseq: "789",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            filePath: "/nonexistent/file.txt"
                        };
                        promise = service.downloadFileFromShell(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        encoder = new TextEncoder();
                        errorContent = "cat: /nonexistent/file.txt: No such file or directory";
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: JSON.stringify({ message: { data: __spreadArray([0], encoder.encode(errorContent), true) } }) }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: JSON.stringify({ message: { data: __spreadArray([0], encoder.encode('{"exit_code": 1}'), true) } }) }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 5:
                        result = _b.sent();
                        expect(result).toEqual({ ok: false, code: "unknown", message: errorContent });
                        expect(saveFile).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles cancellation via AbortSignal", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, abortController, input, promise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        abortController = new AbortController();
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "999",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            filePath: "/app/file.txt",
                            signal: abortController.signal
                        };
                        promise = service.downloadFileFromShell(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        abortController.abort();
                        return [4 /*yield*/, promise];
                    case 2:
                        result = _b.sent();
                        expect(result).toEqual({ ok: false, code: "cancelled" });
                        expect(saveFile).not.toHaveBeenCalled();
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when no file content is received", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, encoder, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "111",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            filePath: "/app/file.txt"
                        };
                        promise = service.downloadFileFromShell(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        encoder = new TextEncoder();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({
                                    message: { data: __spreadArray([0], encoder.encode('{"exit_code": 0}'), true) }
                                })
                            }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 4:
                        result = _b.sent();
                        expect(result).toEqual({ ok: false, code: "unknown", message: expect.any(String) });
                        expect(saveFile).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("extracts filename correctly from path", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, saveFile, websocket, input, promise, encoder;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, saveFile = _a.saveFile, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "222",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            filePath: "/very/long/path/to/myfile.log"
                        };
                        promise = service.downloadFileFromShell(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        encoder = new TextEncoder();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({ message: { data: __spreadArray([0], encoder.encode("log content"), true) } })
                            }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({ message: { data: __spreadArray([0], encoder.encode('{"exit_code": 0}'), true) } })
                            }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, promise];
                    case 5:
                        _b.sent();
                        expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "myfile.log");
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("getLogsStream", function () {
        it("streams log messages", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, stream, logMessages, messagesPromise, _i, logMessages_2, logMessage, results;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "123",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet"
                        };
                        stream = service.getLogsStream(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        logMessages = [
                            { name: "web-service-1", message: "Log message 1", service: "web" },
                            { name: "web-service-2", message: "Log message 2", service: "web" }
                        ];
                        messagesPromise = Promise.all([stream.next(), stream.next()]);
                        _i = 0, logMessages_2 = logMessages;
                        _b.label = 2;
                    case 2:
                        if (!(_i < logMessages_2.length)) return [3 /*break*/, 5];
                        logMessage = logMessages_2[_i];
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({
                                    message: JSON.stringify(logMessage)
                                })
                            }))];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, messagesPromise];
                    case 6:
                        results = _b.sent();
                        expect(results[0].value).toEqual({ message: logMessages[0] });
                        expect(results[1].value).toEqual({ message: logMessages[1] });
                        expect(results[0].done).toBe(false);
                        expect(results[1].done).toBe(false);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 7:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("streams event messages", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, stream, eventMessage, messagePromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "jwt", value: "token123" },
                            dseq: "456",
                            gseq: 2,
                            oseq: 3,
                            type: "events",
                            chainNetwork: "testnet"
                        };
                        stream = service.getLogsStream(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        eventMessage = {
                            type: "Normal",
                            reason: "Started",
                            object: { name: "web-pod", kind: "Pod", namespace: "default" },
                            note: "Container started",
                            message: "Container started",
                            service: "web",
                            reportingController: "controller",
                            reportingInstance: "instance"
                        };
                        messagePromise = stream.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({
                                    message: JSON.stringify(eventMessage)
                                })
                            }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, messagePromise];
                    case 3:
                        result = _b.sent();
                        expect(result.value).toEqual({ message: eventMessage });
                        expect(result.done).toBe(false);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 4:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("stops streaming when closed message is received", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, stream, messages, consumeStream;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "789",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet"
                        };
                        stream = service.getLogsStream(input);
                        messages = [];
                        consumeStream = (function () { return __awaiter(void 0, void 0, void 0, function () {
                            var _a, stream_1, stream_1_1, entry, e_1_1;
                            var _b, e_1, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _e.trys.push([0, 5, 6, 11]);
                                        _a = true, stream_1 = __asyncValues(stream);
                                        _e.label = 1;
                                    case 1: return [4 /*yield*/, stream_1.next()];
                                    case 2:
                                        if (!(stream_1_1 = _e.sent(), _b = stream_1_1.done, !_b)) return [3 /*break*/, 4];
                                        _d = stream_1_1.value;
                                        _a = false;
                                        entry = _d;
                                        if (entry.closed)
                                            return [3 /*break*/, 4];
                                        if (entry.message) {
                                            messages.push(entry.message);
                                        }
                                        _e.label = 3;
                                    case 3:
                                        _a = true;
                                        return [3 /*break*/, 1];
                                    case 4: return [3 /*break*/, 11];
                                    case 5:
                                        e_1_1 = _e.sent();
                                        e_1 = { error: e_1_1 };
                                        return [3 /*break*/, 11];
                                    case 6:
                                        _e.trys.push([6, , 9, 10]);
                                        if (!(!_a && !_b && (_c = stream_1.return))) return [3 /*break*/, 8];
                                        return [4 /*yield*/, _c.call(stream_1)];
                                    case 7:
                                        _e.sent();
                                        _e.label = 8;
                                    case 8: return [3 /*break*/, 10];
                                    case 9:
                                        if (e_1) throw e_1.error;
                                        return [7 /*endfinally*/];
                                    case 10: return [7 /*endfinally*/];
                                    case 11: return [2 /*return*/];
                                }
                            });
                        }); })();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({
                                    message: JSON.stringify({
                                        name: "web-service",
                                        message: "First message",
                                        service: "web"
                                    })
                                })
                            }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify({ closed: true })
                            }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, consumeStream];
                    case 5:
                        _b.sent();
                        expect(messages).toHaveLength(1);
                        expect(messages[0].message).toBe("First message");
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles cancellation via AbortSignal", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, abortController, input, stream, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        abortController = new AbortController();
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "999",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet",
                            signal: abortController.signal
                        };
                        stream = service.getLogsStream(input);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, Promise.all([stream.next(), abortController.abort()])];
                    case 2:
                        result = (_b.sent())[0];
                        expect(result.done).toBe(true);
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("includes `tail`, `services` and `follow` parameters in request", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "111",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet",
                            tail: 200,
                            services: ["web", "api"],
                            follow: true
                        };
                        service.getLogsStream(input).next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledWith(expect.stringContaining("tail=200"));
                        expect(websocket.send).toHaveBeenCalledWith(expect.stringContaining("service=web,api"));
                        expect(websocket.send).toHaveBeenCalledWith(expect.stringContaining("follow=true"));
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not retry on invalid provider certificate", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, createWebSocket, input, stream;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        jest.useFakeTimers();
                        _a = setup(), service = _a.service, websocket = _a.websocket, createWebSocket = _a.createWebSocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "111",
                            gseq: 1,
                            oseq: 1,
                            type: "logs",
                            chainNetwork: "mainnet"
                        };
                        stream = service.getLogsStream(input);
                        stream.next();
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, Promise.all([
                                (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close", { code: provider_proxy_service_1.WS_ERRORS.VIOLATED_POLICY, reason: "invalidCertificate.notSelfSigned" })),
                                jest.runOnlyPendingTimersAsync()
                            ])];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(10000)];
                    case 3:
                        _b.sent();
                        expect(createWebSocket).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("connectToShell", function () {
        it("constructs correct URL with default command", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.example.com",
                            providerAddress: "akash1test",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "100",
                            gseq: 2,
                            oseq: 3,
                            chainNetwork: "mainnet",
                            service: "web-service"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.url).toBe("https://provider.example.com/lease/100/2/3/shell?stdin=0&tty=0&podIndex=0&&cmd0=%2Fbin%2Fsh&service=web-service");
                        return [2 /*return*/];
                }
            });
        }); });
        it("constructs correct URL with custom command", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "456",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "api",
                            command: "cat /app/config.json"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.url).toContain("cmd0=cat");
                        expect(sentMessage.url).toContain("cmd1=%2Fapp%2Fconfig.json");
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles stdin and tty options", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "789",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            useStdIn: true,
                            useTTY: true
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.url).toContain("stdin=1");
                        expect(sentMessage.url).toContain("tty=1");
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles command with multiple arguments", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "333",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            command: "ls -la /app"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.url).toContain("cmd0=ls");
                        expect(sentMessage.url).toContain("cmd1=-la");
                        expect(sentMessage.url).toContain("cmd2=%2Fapp");
                        return [2 /*return*/];
                }
            });
        }); });
        it("includes credentials in sent messages", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "test-cert", key: "test-key" } },
                            dseq: "444",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array([1, 2, 3]));
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.auth).toEqual({
                            type: "mtls",
                            certPem: "test-cert",
                            keyPem: "test-key"
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it("includes JWT credentials in sent messages", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "jwt", value: "token123" },
                            dseq: "555",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array([1, 2, 3]));
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.auth).toEqual({
                            type: "jwt",
                            token: "token123"
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it("includes data field when message has content", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, encoder, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "666",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        encoder = new TextEncoder();
                        session.send(encoder.encode("echo hello"));
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.data).toBe(encoder.encode("echo hello").toString());
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not include data field when message is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, sentMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "777",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        expect(sentMessage.data).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles abort signal", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, abortController, input, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        abortController = new AbortController();
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "888",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web",
                            signal: abortController.signal
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        abortController.abort();
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("can send multiple messages", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, encoder, firstMessage, secondMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "1000",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        encoder = new TextEncoder();
                        session.send(encoder.encode("first"));
                        session.send(encoder.encode("second"));
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(2);
                        firstMessage = JSON.parse(websocket.send.mock.calls[0][0]);
                        secondMessage = JSON.parse(websocket.send.mock.calls[1][0]);
                        expect(firstMessage.data).toBe(encoder.encode("first").toString());
                        expect(secondMessage.data).toBe(encoder.encode("second").toString());
                        return [2 /*return*/];
                }
            });
        }); });
        it("receives shell messages through async iterator", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, input, session, encoder, messagePromise, shellMessage, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, websocket = _a.websocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "1111",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        session.send(new Uint8Array());
                        encoder = new TextEncoder();
                        messagePromise = session.receive().next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        shellMessage = {
                            message: { data: __spreadArray([0], encoder.encode("output data"), true) }
                        };
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", {
                                data: JSON.stringify(shellMessage)
                            }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, messagePromise];
                    case 3:
                        result = _b.sent();
                        expect(result.value).toEqual(shellMessage);
                        expect(result.done).toBe(false);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("close"))];
                    case 4:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not retry on invalid provider certificate", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, websocket, createWebSocket, input, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        jest.useFakeTimers();
                        _a = setup(), service = _a.service, websocket = _a.websocket, createWebSocket = _a.createWebSocket;
                        input = {
                            providerBaseUrl: "https://provider.akash.network",
                            providerAddress: "akash1provider",
                            providerCredentials: { type: "mtls", value: { cert: "cert", key: "key" } },
                            dseq: "1111",
                            gseq: 1,
                            oseq: 1,
                            chainNetwork: "mainnet",
                            service: "web"
                        };
                        session = service.connectToShell(input);
                        session.receive().next();
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, Promise.all([
                                (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close", { code: provider_proxy_service_1.WS_ERRORS.VIOLATED_POLICY, reason: "invalidCertificate.notSelfSigned" })),
                                jest.runOnlyPendingTimersAsync()
                            ])];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(10000)];
                    case 3:
                        _b.sent();
                        expect(createWebSocket).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(input) {
        var httpClient = (input === null || input === void 0 ? void 0 : input.httpClient) || (0, jest_mock_extended_1.mock)();
        var logger = (input === null || input === void 0 ? void 0 : input.logger) || (0, jest_mock_extended_1.mock)();
        var saveFile = (input === null || input === void 0 ? void 0 : input.saveFile) || jest.fn();
        var websocket = (0, websocketMock_1.createWebsocketMock)();
        var createWebSocket = jest.fn(function () { return websocket; });
        var service = new provider_proxy_service_1.ProviderProxyService(httpClient, logger, createWebSocket, saveFile);
        return { service: service, httpClient: httpClient, logger: logger, saveFile: saveFile, websocket: websocket, createWebSocket: createWebSocket };
    }
});
