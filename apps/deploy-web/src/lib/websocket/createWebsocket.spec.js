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
var timer_1 = require("@src/utils/timer");
var createWebsocket_1 = require("./createWebsocket");
var websocketMock_1 = require("@tests/unit/websocketMock");
describe(createWebsocket_1.createWebsocket.name, function () {
    afterEach(function () {
        jest.useRealTimers();
    });
    describe("createWebsocket", function () {
        it("provides access to websocket instance in `open` event", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, openPromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        openPromise = (0, createWebsocket_1.waitForEvent)(wsEvents, "open");
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, openPromise];
                    case 2:
                        result = _b.sent();
                        expect(result).toBe(websocket);
                        return [2 /*return*/];
                }
            });
        }); });
        it("re-dispatches `message` events", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, messagePromise, message;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        messagePromise = (0, createWebsocket_1.waitForEvent)(wsEvents, "message");
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "test message" }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, messagePromise];
                    case 3:
                        message = _b.sent();
                        expect(message).toBe("test message");
                        return [2 /*return*/];
                }
            });
        }); });
        it("dispatches `close` event", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, closePromise;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        closePromise = (0, createWebsocket_1.waitForEvent)(wsEvents, "close");
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, closePromise];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("sends ping messages every 30 seconds", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        jest.useFakeTimers();
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _b.sent();
                        expect(websocket.send).not.toHaveBeenCalled();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(30000)];
                    case 2:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(1);
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(30000)];
                    case 3:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(2);
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(30000)];
                    case 4:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(3);
                        expect(websocket.send.mock.calls).toEqual(Array.from({ length: 3 }, function () { return [JSON.stringify({ type: "ping" })]; }));
                        return [2 /*return*/];
                }
            });
        }); });
        it("stops sending pings after close", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        jest.useFakeTimers();
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(30000)];
                    case 2:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(1);
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close")), jest.runOnlyPendingTimersAsync()])];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(60000)];
                    case 4:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it("stops sending pings after error", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        jest.useFakeTimers();
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(30000)];
                    case 2:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(1);
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocket, new Event("error")), jest.runOnlyPendingTimersAsync()])];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(60000)];
                    case 4:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles abort signal by closing websocket", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, abortController;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        abortController = new AbortController();
                        (0, createWebsocket_1.createWebsocket)({
                            websocketFactory: websocketFactory,
                            signal: abortController.signal
                        });
                        return [4 /*yield*/, (0, timer_1.wait)(10)];
                    case 1:
                        _b.sent();
                        abortController.abort();
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not close websocket if already closed when aborting", function () { return __awaiter(void 0, void 0, void 0, function () {
            var websocketFactory, abortController, websocket;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        websocketFactory = setup({ readyState: WebSocket.CLOSED }).websocketFactory;
                        abortController = new AbortController();
                        (0, createWebsocket_1.createWebsocket)({
                            websocketFactory: websocketFactory,
                            signal: abortController.signal
                        });
                        return [4 /*yield*/, (0, timer_1.wait)(10)];
                    case 1:
                        _a.sent();
                        abortController.abort();
                        expect(websocketFactory).toHaveBeenCalled();
                        websocket = websocketFactory.mock.results[0].value;
                        expect(websocket.close).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("closes websocket when CONNECTING and abort signal is fired", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, abortController;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({ readyState: WebSocket.CONNECTING }), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        abortController = new AbortController();
                        (0, createWebsocket_1.createWebsocket)({
                            websocketFactory: websocketFactory,
                            signal: abortController.signal
                        });
                        return [4 /*yield*/, (0, timer_1.wait)(10)];
                    case 1:
                        _b.sent();
                        abortController.abort();
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("allows adding and removing event listeners", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, listener;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        listener = jest.fn();
                        wsEvents.addEventListener("message", listener);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "test" }))];
                    case 2:
                        _b.sent();
                        expect(listener).toHaveBeenCalledTimes(1);
                        wsEvents.removeEventListener("message", listener);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "test2" }))];
                    case 3:
                        _b.sent();
                        expect(listener).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it("removes all listeners on `close`", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, openListener, messageListener;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        openListener = jest.fn();
                        messageListener = jest.fn();
                        wsEvents.addEventListener("open", openListener);
                        wsEvents.addEventListener("message", messageListener);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        expect(openListener).toHaveBeenCalledTimes(1);
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "test" }))];
                    case 4:
                        _b.sent();
                        expect(openListener).toHaveBeenCalledTimes(1);
                        expect(messageListener).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("removes all listeners on final `error` event", function () { return __awaiter(void 0, void 0, void 0, function () {
            var ws, websocketFactory, wsEvents, openListener, messageListener, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.useFakeTimers();
                        websocketFactory = jest.fn(function () { return (ws = (0, websocketMock_1.createWebsocketMock)()); });
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        openListener = jest.fn();
                        messageListener = jest.fn();
                        wsEvents.addEventListener("open", openListener);
                        wsEvents.addEventListener("message", messageListener);
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(ws, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 1:
                        _a.sent();
                        expect(openListener).toHaveBeenCalledTimes(1);
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < 6)) return [3 /*break*/, 7];
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(ws, new Event("error")), jest.runOnlyPendingTimersAsync()])];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, jest.runOnlyPendingTimersAsync()];
                    case 4:
                        _a.sent(); // flush auto close timer
                        return [4 /*yield*/, jest.runOnlyPendingTimersAsync()];
                    case 5:
                        _a.sent(); // flush retry timers
                        _a.label = 6;
                    case 6:
                        i++;
                        return [3 /*break*/, 2];
                    case 7: return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(ws, new Event("open")), jest.runOnlyPendingTimersAsync()])];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(ws, new MessageEvent("message", { data: "test" })), jest.runOnlyPendingTimersAsync()])];
                    case 9:
                        _a.sent();
                        expect(openListener).toHaveBeenCalledTimes(1);
                        expect(messageListener).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("supports once option for event listeners", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, listener;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        listener = jest.fn();
                        wsEvents.addEventListener("message", listener, { once: true });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "first" }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "second" }))];
                    case 3:
                        _b.sent();
                        expect(listener).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it("creates websocket using factory", function () {
            var _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
            (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
            expect(websocketFactory).toHaveBeenCalledTimes(1);
            expect(websocket.onopen).toBeDefined();
            expect(websocket.onmessage).toBeDefined();
            expect(websocket.onerror).toBeDefined();
            expect(websocket.onclose).toBeDefined();
        });
        it("can handle multiple message events", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, wsEvents, messages;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                        messages = [];
                        wsEvents.addEventListener("message", function (event) {
                            messages.push(event.detail);
                        });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "msg1" }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "msg2" }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "msg3" }))];
                    case 4:
                        _b.sent();
                        expect(messages).toEqual(["msg1", "msg2", "msg3"]);
                        return [2 /*return*/];
                }
            });
        }); });
        describe("retry behavior", function () {
            it("retries on error up to 5 times", function () { return __awaiter(void 0, void 0, void 0, function () {
                var websocketFactory, wsEvents, onError, i, ws, errorPromise;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            jest.useFakeTimers();
                            websocketFactory = jest.fn(function () { return (0, websocketMock_1.createWebsocketMock)(); });
                            wsEvents = (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                            onError = jest.fn();
                            wsEvents.addEventListener("error", onError);
                            i = 0;
                            _c.label = 1;
                        case 1:
                            if (!(i < 7)) return [3 /*break*/, 7];
                            ws = websocketFactory.mock.results.at(-1).value;
                            errorPromise = new Promise(function (resolve) { return wsEvents.addEventListener("attempt-error", resolve); });
                            return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(ws, new Event("error")), jest.runOnlyPendingTimersAsync()])];
                        case 2:
                            _c.sent();
                            return [4 /*yield*/, jest.runOnlyPendingTimersAsync()];
                        case 3:
                            _c.sent();
                            return [4 /*yield*/, errorPromise];
                        case 4:
                            _c.sent();
                            return [4 /*yield*/, jest.runOnlyPendingTimersAsync()];
                        case 5:
                            _c.sent();
                            _c.label = 6;
                        case 6:
                            i++;
                            return [3 /*break*/, 1];
                        case 7:
                            expect(websocketFactory).toHaveBeenCalledTimes(6);
                            expect(onError).toHaveBeenCalledTimes(1);
                            expect((_b = (_a = onError.mock.calls[0][0]) === null || _a === void 0 ? void 0 : _a.detail) === null || _b === void 0 ? void 0 : _b.message).toMatch(/Generic websocket error/i);
                            return [2 /*return*/];
                    }
                });
            }); });
            it("do not retrying after successful connection", function () { return __awaiter(void 0, void 0, void 0, function () {
                var websocketFactory, ws;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            websocketFactory = jest.fn(function () { return (0, websocketMock_1.createWebsocketMock)(); });
                            (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory });
                            ws = websocketFactory.mock.results.at(-1).value;
                            return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(ws, new Event("open"))];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(ws, new CloseEvent("close"))];
                        case 2:
                            _a.sent();
                            expect(websocketFactory).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it("uses `shouldRetry` option to determine if should retry", function () { return __awaiter(void 0, void 0, void 0, function () {
                var websocketFactory, shouldRetry, closeEvent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            jest.useFakeTimers();
                            websocketFactory = jest.fn(function () { return (0, websocketMock_1.createWebsocketMock)(); });
                            shouldRetry = jest.fn(function (error) {
                                var _a;
                                var event = error.cause;
                                return !error.cause || !((_a = event.reason) === null || _a === void 0 ? void 0 : _a.includes("fatal"));
                            });
                            (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory, shouldRetry: shouldRetry });
                            return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocketFactory.mock.results.at(-1).value, new Event("error")), jest.runOnlyPendingTimersAsync()])];
                        case 1:
                            _a.sent();
                            closeEvent = new CloseEvent("close", { reason: "fatal", code: 22 });
                            return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocketFactory.mock.results.at(-1).value, closeEvent), jest.runOnlyPendingTimersAsync()])];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, jest.runOnlyPendingTimersAsync()];
                        case 3:
                            _a.sent();
                            expect(websocketFactory).toHaveBeenCalledTimes(1);
                            expect(shouldRetry).toHaveBeenCalledWith(expect.objectContaining({
                                message: "websocket error",
                                cause: {
                                    code: closeEvent.code,
                                    reason: closeEvent.reason,
                                    wasClean: closeEvent.wasClean
                                }
                            }));
                            return [2 /*return*/];
                    }
                });
            }); });
            it("does not retry after abort signal", function () { return __awaiter(void 0, void 0, void 0, function () {
                var abortController, websocketFactory;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            jest.useFakeTimers();
                            abortController = new AbortController();
                            websocketFactory = jest.fn(function () { return (0, websocketMock_1.createWebsocketMock)(); });
                            (0, createWebsocket_1.createWebsocket)({ websocketFactory: websocketFactory, signal: abortController.signal });
                            return [4 /*yield*/, Promise.all([(0, websocketMock_1.dispatchWsEvent)(websocketFactory.mock.results.at(-1).value, new Event("error")), jest.runOnlyPendingTimersAsync()])];
                        case 1:
                            _a.sent();
                            expect(websocketFactory).toHaveBeenCalledTimes(1);
                            abortController.abort();
                            return [4 /*yield*/, jest.advanceTimersByTimeAsync(10000)];
                        case 2:
                            _a.sent();
                            expect(websocketFactory).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe("waitForEvent", function () {
        it("resolves with event detail when event is dispatched", function () { return __awaiter(void 0, void 0, void 0, function () {
            var events, promise, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        events = new EventTarget();
                        promise = (0, createWebsocket_1.waitForEvent)(events, "message");
                        events.dispatchEvent(new CustomEvent("message", { detail: "test data" }));
                        return [4 /*yield*/, promise];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe("test data");
                        return [2 /*return*/];
                }
            });
        }); });
        it("resolves with undefined when close event is dispatched", function () { return __awaiter(void 0, void 0, void 0, function () {
            var events, promise, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        events = new EventTarget();
                        promise = (0, createWebsocket_1.waitForEvent)(events, "message");
                        events.dispatchEvent(new CustomEvent("close"));
                        return [4 /*yield*/, promise];
                    case 1:
                        result = _a.sent();
                        expect(result).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        it("rejects when error event is dispatched", function () { return __awaiter(void 0, void 0, void 0, function () {
            var events, promise, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        events = new EventTarget();
                        promise = (0, createWebsocket_1.waitForEvent)(events, "message");
                        error = new Error("test error");
                        events.dispatchEvent(new CustomEvent("error", { detail: error }));
                        return [4 /*yield*/, expect(promise).rejects.toThrow(error)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("cleans up listeners after resolving", function () { return __awaiter(void 0, void 0, void 0, function () {
            var events, promise;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        events = new EventTarget();
                        promise = (0, createWebsocket_1.waitForEvent)(events, "message");
                        jest.spyOn(events, "removeEventListener");
                        events.dispatchEvent(new CustomEvent("message", { detail: "test" }));
                        return [4 /*yield*/, promise];
                    case 1:
                        _a.sent();
                        expect(events.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function));
                        expect(events.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
                        expect(events.removeEventListener).toHaveBeenCalledWith("close", expect.any(Function));
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(options) {
        var websocket = (0, websocketMock_1.createWebsocketMock)();
        if ((options === null || options === void 0 ? void 0 : options.readyState) !== undefined) {
            Object.defineProperty(websocket, "readyState", {
                value: options.readyState,
                writable: true
            });
        }
        var websocketFactory = jest.fn(function () { return websocket; });
        return { websocket: websocket, websocketFactory: websocketFactory };
    }
});
