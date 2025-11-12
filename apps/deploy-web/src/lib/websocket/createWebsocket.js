"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebsocket = createWebsocket;
exports.waitForEvent = waitForEvent;
var cockatiel_1 = require("cockatiel");
function createWebsocket(input) {
    var policy = (0, cockatiel_1.retry)(input.shouldRetry ? (0, cockatiel_1.handleWhen)(input.shouldRetry) : cockatiel_1.handleAll, {
        maxAttempts: 5,
        backoff: new cockatiel_1.ExponentialBackoff({
            initialDelay: 500,
            maxDelay: 10 * 1000
        })
    });
    var bus = new EventTarget();
    var listeners = [];
    policy
        .execute(function () {
        return new Promise(function (resolve, reject) {
            var _a;
            var ws = input.websocketFactory();
            (_a = input.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", function () {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            }, { once: true });
            var pingPongTimerId;
            ws.onopen = function () {
                bus.dispatchEvent(new CustomEvent("open", { detail: ws }));
                pingPongTimerId = setInterval(function () {
                    if (ws.readyState !== WebSocket.OPEN) {
                        clearInterval(pingPongTimerId);
                        return;
                    }
                    ws.send(JSON.stringify({
                        type: "ping"
                    }));
                }, 30 * 1000);
            };
            ws.onmessage = function (event) {
                bus.dispatchEvent(new CustomEvent("message", { detail: event.data }));
            };
            var isFailed = false;
            var forceCleanTimerId;
            ws.onerror = function (event) {
                isFailed = true;
                // According to the WebSocket spec, when error event is dispatched,
                // there will be follow up "close" event. BUT let's ensure that state is cleaned
                forceCleanTimerId = setTimeout(function () {
                    closeConn(event);
                }, 100);
            };
            var closeConn = function (event) {
                var _a;
                clearTimeout(forceCleanTimerId);
                var error = createWsError(event);
                if (!isFailed) {
                    bus.dispatchEvent(new CustomEvent("close"));
                }
                else {
                    bus.dispatchEvent(new CustomEvent("attempt-error", { detail: error }));
                }
                clearInterval(pingPongTimerId);
                if (isFailed || ((_a = input.shouldRetry) === null || _a === void 0 ? void 0 : _a.call(input, error))) {
                    reject(error);
                }
                else {
                    resolve();
                }
            };
            ws.onclose = closeConn;
        });
    }, input.signal)
        .catch(function (error) {
        bus.dispatchEvent(new CustomEvent("error", { detail: error }));
    })
        .finally(function () {
        listeners.forEach(function (_a) {
            var event = _a.event, listener = _a.listener;
            bus.removeEventListener(event, listener);
        });
    });
    return {
        addEventListener: function (type, listener, options) {
            listeners.push({ event: type, listener: listener });
            bus.addEventListener(type, listener, options);
        },
        removeEventListener: function (type, listener) {
            listeners = listeners.filter(function (l) { return !(l.event === type && l.listener === listener); });
            bus.removeEventListener(type, listener);
        }
    };
}
function waitForEvent(target, type) {
    return new Promise(function (resolve, reject) {
        var onMessage = function (event) {
            resolve(event.detail);
            cleanup();
        };
        var onError = function (event) {
            reject(event.detail);
            cleanup();
        };
        var onClose = function () {
            resolve(undefined);
            cleanup();
        };
        var cleanup = function () {
            target.removeEventListener(type, onMessage);
            target.removeEventListener("error", onError);
            target.removeEventListener("close", onClose);
        };
        target.addEventListener(type, onMessage, { once: true });
        target.addEventListener("error", onError, { once: true });
        target.addEventListener("close", onClose, { once: true });
    });
}
function createWsError(event) {
    if (event instanceof CloseEvent) {
        return new Error("websocket error", {
            cause: {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            }
        });
    }
    // https://websockets.spec.whatwg.org/#eventdef-websocket-error
    return new Error("Generic websocket error");
}
