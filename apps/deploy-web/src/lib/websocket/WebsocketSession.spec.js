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
var WebsocketSession_1 = require("./WebsocketSession");
var websocketMock_1 = require("@tests/unit/websocketMock");
describe(WebsocketSession_1.WebsocketSession.name, function () {
    afterEach(function () {
        jest.useRealTimers();
    });
    describe("send", function () {
        it("creates websocket connection on first send", function () {
            var websocketFactory = setup().websocketFactory;
            var session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
            expect(websocketFactory).not.toHaveBeenCalled();
            session.send({ type: "test" });
            expect(websocketFactory).toHaveBeenCalled();
        });
        it("sends message immediately if websocket is already open", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        session.send({ type: "test", data: "hello" }); // connect to socket first
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        session.send({ type: "test", data: "world" });
                        expect(websocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "test", data: "hello" }));
                        expect(websocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "test", data: "world" }));
                        return [2 /*return*/];
                }
            });
        }); });
        it("queues messages when websocket is not open", function () {
            var _a = setup({ readyState: WebSocket.CONNECTING }), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
            var session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
            session.send({ type: "test1" });
            session.send({ type: "test2" });
            expect(websocket.send).not.toHaveBeenCalled();
        });
        it("sends queued messages after websocket opens", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({ readyState: WebSocket.CONNECTING }), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        session.send({ type: "test1" });
                        session.send({ type: "test2" });
                        Object.defineProperty(websocket, "readyState", { value: WebSocket.OPEN, writable: true });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        expect(websocket.send).toHaveBeenCalledTimes(2);
                        expect(websocket.send).toHaveBeenNthCalledWith(1, JSON.stringify({ type: "test1" }));
                        expect(websocket.send).toHaveBeenNthCalledWith(2, JSON.stringify({ type: "test2" }));
                        return [2 /*return*/];
                }
            });
        }); });
        it("uses custom `transformSentMessage` option", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, transformSentMessage, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        transformSentMessage = jest.fn(function (msg) { return "custom:".concat(JSON.stringify(msg)); });
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory, transformSentMessage: transformSentMessage });
                        session.send({ type: "test" });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        expect(transformSentMessage).toHaveBeenCalledWith({ type: "test" });
                        expect(websocket.send).toHaveBeenCalledWith('custom:{"type":"test"}');
                        return [2 /*return*/];
                }
            });
        }); });
        it("only creates websocket connection once for multiple sends", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        session.send({ type: "test1" });
                        session.send({ type: "test2" });
                        session.send({ type: "test3" });
                        expect(websocketFactory).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("receive", function () {
        it("creates websocket connection on first receive", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, receivePromise;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator = session.receive();
                        receivePromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, receivePromise];
                    case 3:
                        _b.sent();
                        expect(websocketFactory).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("yields transformed messages", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, result1Promise, result1, result2Promise, result2, result3Promise, result3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator = session.receive();
                        result1Promise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"msg1"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, result1Promise];
                    case 3:
                        result1 = _b.sent();
                        expect(result1.value).toEqual({ type: "msg1" });
                        result2Promise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"msg2"}' }))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, result2Promise];
                    case 5:
                        result2 = _b.sent();
                        expect(result2.value).toEqual({ type: "msg2" });
                        result3Promise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, result3Promise];
                    case 7:
                        result3 = _b.sent();
                        expect(result3.done).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        it("uses custom transformReceivedMessage", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, transformReceivedMessage, session, generator, resultPromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        transformReceivedMessage = jest.fn(function (msg) { return ({ transformed: msg }); });
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory, transformReceivedMessage: transformReceivedMessage });
                        generator = session.receive();
                        resultPromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: "raw-message" }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, resultPromise];
                    case 3:
                        result = _b.sent();
                        expect(transformReceivedMessage).toHaveBeenCalledWith("raw-message");
                        expect(result.value).toEqual({ transformed: "raw-message" });
                        return [2 /*return*/];
                }
            });
        }); });
        it("filters messages using ignoreMessage option", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, result1Promise, result1, result2Promise, result2, result3Promise, result3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator = session.receive();
                        result1Promise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"ping"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"data","value":1}' }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, result1Promise];
                    case 4:
                        result1 = _b.sent();
                        expect(result1.value).toEqual({ type: "data", value: 1 });
                        result2Promise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"pong"}' }))];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"data","value":2}' }))];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, result2Promise];
                    case 7:
                        result2 = _b.sent();
                        expect(result2.value).toEqual({ type: "data", value: 2 });
                        result3Promise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, result3Promise];
                    case 9:
                        result3 = _b.sent();
                        expect(result3.done).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        it("uses custom ignoreMessage function", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, ignoreMessage, session, generator, resultPromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        ignoreMessage = jest.fn(function (msg) {
                            if (msg && typeof msg === "object" && "type" in msg) {
                                return msg.type === "ignore";
                            }
                            return false;
                        });
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory, ignoreMessage: ignoreMessage });
                        generator = session.receive();
                        resultPromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"ignore"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"keep"}' }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, resultPromise];
                    case 4:
                        result = _b.sent();
                        expect(ignoreMessage).toHaveBeenCalledWith({ type: "ignore" });
                        expect(ignoreMessage).toHaveBeenCalledWith({ type: "keep" });
                        expect(result.value).toEqual({ type: "keep" });
                        return [2 /*return*/];
                }
            });
        }); });
        it("stops iteration when close event is dispatched", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, resultPromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator = session.receive();
                        resultPromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, resultPromise];
                    case 3:
                        result = _b.sent();
                        expect(result.done).toBe(true);
                        expect(result.value).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        it("only creates websocket connection once for multiple receive calls", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator1, result1Promise, generator2, result2Promise;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator1 = session.receive();
                        result1Promise = generator1.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"msg1"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, result1Promise];
                    case 3:
                        _b.sent();
                        generator2 = session.receive();
                        result2Promise = generator2.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"msg2"}' }))];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, result2Promise];
                    case 5:
                        _b.sent();
                        expect(websocketFactory).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("disconnect", function () {
        it("closes websocket if it exists", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        session.send({ type: "test" });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        session.disconnect();
                        expect(websocket.close).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("clears websocket reference after disconnect", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        session.send({ type: "test" });
                        session.disconnect();
                        session.send({ type: "queued" });
                        expect(websocketFactory).toHaveBeenCalledTimes(2);
                        return [2 /*return*/];
                }
            });
        }); });
        it("clears message queue on disconnect", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup({ readyState: WebSocket.CONNECTING }), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        session.send({ type: "queued1" });
                        session.send({ type: "queued2" });
                        session.disconnect();
                        Object.defineProperty(websocket, "readyState", { value: WebSocket.OPEN, writable: true });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        expect(websocket.send).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not throw if websocket does not exist", function () {
            var websocketFactory = setup().websocketFactory;
            var session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
            expect(function () { return session.disconnect(); }).not.toThrow();
        });
    });
    describe("connection lifecycle", function () {
        it("automatically cleans up on `close` event", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        session.send({ type: "test" });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new CloseEvent("close"))];
                    case 2:
                        _b.sent();
                        session.send({ type: "new-message" });
                        expect(websocketFactory).toHaveBeenCalledTimes(2);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("default message filtering", function () {
        it("filters out ping messages by default", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, resultPromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator = session.receive();
                        resultPromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"ping"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"data"}' }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, resultPromise];
                    case 4:
                        result = _b.sent();
                        expect(result.value).toEqual({ type: "data" });
                        return [2 /*return*/];
                }
            });
        }); });
        it("filters out pong messages by default", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, resultPromise, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        generator = session.receive();
                        resultPromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"pong"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"type":"data"}' }))];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, resultPromise];
                    case 4:
                        result = _b.sent();
                        expect(result.value).toEqual({ type: "data" });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("integration scenarios", function () {
        it("handles send and receive simultaneously", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, websocket, websocketFactory, session, generator, responsePromise, response;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), websocket = _a.websocket, websocketFactory = _a.websocketFactory;
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        session.send({ command: "test" });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new Event("open"))];
                    case 1:
                        _b.sent();
                        generator = session.receive();
                        responsePromise = generator.next();
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(websocket, new MessageEvent("message", { data: '{"response":"ok"}' }))];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, responsePromise];
                    case 3:
                        response = _b.sent();
                        expect(websocket.send).toHaveBeenCalledWith('{"command":"test"}');
                        expect(response.value).toEqual({ response: "ok" });
                        return [2 /*return*/];
                }
            });
        }); });
        it("reconnects after disconnect", function () { return __awaiter(void 0, void 0, void 0, function () {
            var ws, websocketFactory, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        websocketFactory = jest.fn(function () { return (ws = (0, websocketMock_1.createWebsocketMock)()); });
                        session = new WebsocketSession_1.WebsocketSession({ websocketFactory: websocketFactory });
                        session.send({ type: "first" });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(ws, new Event("open"))];
                    case 1:
                        _a.sent();
                        expect(ws.send).toHaveBeenCalledWith('{"type":"first"}');
                        Object.assign(ws, { used: true });
                        return [4 /*yield*/, session.disconnect()];
                    case 2:
                        _a.sent();
                        session.send({ type: "second" });
                        return [4 /*yield*/, (0, websocketMock_1.dispatchWsEvent)(ws, new Event("open"))];
                    case 3:
                        _a.sent();
                        expect(ws.send).toHaveBeenCalledWith('{"type":"second"}');
                        expect(websocketFactory).toHaveBeenCalledTimes(2);
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
