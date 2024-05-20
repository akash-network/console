"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrettyTime = exports.toUTC = exports.endOfDay = exports.startOfDay = exports.getTodayUTC = exports.getDayStr = void 0;
const math_1 = require("./math");
const getDayStr = (date) => {
    return date ? toUTC(date).toISOString().split("T")[0] : getTodayUTC().toISOString().split("T")[0];
};
exports.getDayStr = getDayStr;
function getTodayUTC() {
    let currentDate = toUTC(new Date());
    currentDate.setUTCHours(0, 0, 0, 0);
    return currentDate;
}
exports.getTodayUTC = getTodayUTC;
function startOfDay(date) {
    let currentDate = toUTC(date);
    currentDate.setUTCHours(0, 0, 0, 0);
    return currentDate;
}
exports.startOfDay = startOfDay;
function endOfDay(date) {
    let currentDate = toUTC(date);
    currentDate.setUTCHours(23, 59, 59, 999);
    return currentDate;
}
exports.endOfDay = endOfDay;
function toUTC(date) {
    const now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
    return new Date(now_utc);
}
exports.toUTC = toUTC;
function getPrettyTime(timeMs) {
    if (timeMs < 10) {
        return `${(0, math_1.round)(timeMs, 2)}ms`;
    }
    else if (timeMs < 1000) {
        return `${(0, math_1.round)(timeMs, 0)}ms`;
    }
    else if (timeMs < 60 * 1000) {
        return `${(0, math_1.round)(timeMs / 1000, 2)}s`;
    }
    else if (timeMs < 60 * 60 * 1000) {
        return `${Math.floor(timeMs / 1000 / 60)}m ${Math.round((timeMs / 1000) % 60)}s`;
    }
    else {
        return `${Math.floor(timeMs / 1000 / 60 / 60)}h ${Math.floor(timeMs / 1000 / 60) % 60}m`;
    }
}
exports.getPrettyTime = getPrettyTime;
//# sourceMappingURL=date.js.map