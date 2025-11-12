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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsocketSession = void 0;
var createWebsocket_1 = require("./createWebsocket");
var WebsocketSession = /** @class */ (function () {
    function WebsocketSession(options) {
        this.messageQueue = [];
        this.options = __assign({ transformReceivedMessage: function (value) { return JSON.parse(value); }, transformSentMessage: function (value) { return JSON.stringify(value); }, ignoreMessage: ignorePingPongMessage }, options);
    }
    WebsocketSession.prototype.connect = function () {
        var _this = this;
        if (this.wsEvents)
            return this.wsEvents;
        this.wsEvents = (0, createWebsocket_1.createWebsocket)(this.options);
        this.wsEvents.addEventListener("open", function (event) {
            _this.ws = event.detail;
            while (_this.messageQueue.length > 0) {
                _this.send(_this.messageQueue.shift());
            }
        });
        var cleanup = function () { return _this.cleanup(); };
        this.wsEvents.addEventListener("close", cleanup, { once: true });
        this.wsEvents.addEventListener("error", cleanup, { once: true });
        return this.wsEvents;
    };
    WebsocketSession.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var closePromise;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.ws) return [3 /*break*/, 2];
                        closePromise = this.wsEvents ? (0, createWebsocket_1.waitForEvent)(this.wsEvents, "close") : Promise.resolve();
                        this.ws.close();
                        return [4 /*yield*/, closePromise];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.cleanup();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebsocketSession.prototype.cleanup = function () {
        this.ws = undefined;
        this.wsEvents = undefined;
        this.messageQueue = [];
    };
    WebsocketSession.prototype.send = function (message) {
        var _a;
        this.connect();
        if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            return;
        }
        this.ws.send(this.options.transformSentMessage(message));
    };
    WebsocketSession.prototype.receive = function () {
        return __asyncGenerator(this, arguments, function receive_1() {
            var wsEvents, message, transformedMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        wsEvents = this.connect();
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 6];
                        return [4 /*yield*/, __await((0, createWebsocket_1.waitForEvent)(wsEvents, "message"))];
                    case 2:
                        message = _a.sent();
                        if (!message)
                            return [3 /*break*/, 6];
                        transformedMessage = this.options.transformReceivedMessage(message);
                        if (!(!this.options.ignoreMessage || !this.options.ignoreMessage(transformedMessage))) return [3 /*break*/, 5];
                        return [4 /*yield*/, __await(transformedMessage)];
                    case 3: return [4 /*yield*/, _a.sent()];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return WebsocketSession;
}());
exports.WebsocketSession = WebsocketSession;
function ignorePingPongMessage(message) {
    return !!message && typeof message === "object" && "type" in message && (message.type === "ping" || message.type === "pong");
}
