"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLogMessage = formatLogMessage;
exports.formatK8sEvent = formatK8sEvent;
function formatLogMessage(logEntry) {
    var serviceName = (logEntry === null || logEntry === void 0 ? void 0 : logEntry.name) ? logEntry === null || logEntry === void 0 ? void 0 : logEntry.name.split("-")[0] : "";
    // logEntry.message = `[${format(new Date(), "yyyy-MM-dd|HH:mm:ss.SSS")}] ${logEntry.service}: ${logEntry.message}`;
    return "[".concat(serviceName, "]: ").concat(logEntry.message);
}
function formatK8sEvent(k8sEvent) {
    var _a, _b, _c;
    var serviceName = ((_a = k8sEvent.object) === null || _a === void 0 ? void 0 : _a.name) ? (_b = k8sEvent.object) === null || _b === void 0 ? void 0 : _b.name.split("-")[0] : "";
    return "[".concat(serviceName, "]: [").concat(k8sEvent.type, "] [").concat(k8sEvent.reason, "] [").concat((_c = k8sEvent.object) === null || _c === void 0 ? void 0 : _c.kind, "] ").concat(k8sEvent.note);
}
