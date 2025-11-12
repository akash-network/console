"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDayStr = exports.epochToDate = exports.averageDaysInMonth = void 0;
exports.getTodayUTC = getTodayUTC;
exports.toUTC = toUTC;
exports.getPrettyTime = getPrettyTime;
exports.createDateRange = createDateRange;
var date_fns_1 = require("date-fns");
var mathHelpers_1 = require("./mathHelpers");
exports.averageDaysInMonth = 30.437;
var epochToDate = function (epoch) {
    // The 0 sets the date to the epoch
    var d = new Date(0);
    d.setUTCSeconds(epoch);
    return d;
};
exports.epochToDate = epochToDate;
var getDayStr = function (date) {
    return date ? toUTC(date).toISOString().split("T")[0] : getTodayUTC().toISOString().split("T")[0];
};
exports.getDayStr = getDayStr;
function getTodayUTC() {
    var currentDate = toUTC(new Date());
    currentDate.setUTCHours(0, 0, 0, 0);
    return currentDate;
}
function toUTC(date) {
    var now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
    return new Date(now_utc);
}
function getPrettyTime(timeMs) {
    if (timeMs < 10) {
        return "".concat((0, mathHelpers_1.roundDecimal)(timeMs, 2), "ms");
    }
    else if (timeMs < 1000) {
        return "".concat((0, mathHelpers_1.roundDecimal)(timeMs, 0), "ms");
    }
    else if (timeMs < 60 * 1000) {
        return "".concat((0, mathHelpers_1.roundDecimal)(timeMs / 1000, 2), "s");
    }
    else if (timeMs < 60 * 60 * 1000) {
        return "".concat(Math.floor(timeMs / 1000 / 60), "m ").concat((0, mathHelpers_1.roundDecimal)((timeMs / 1000) % 60, 2), "s");
    }
    else {
        return "".concat(Math.floor(timeMs / 1000 / 60 / 60), "h ").concat((0, mathHelpers_1.roundDecimal)(timeMs / 1000 / 60, 2) % 60, "m");
    }
}
function createDateRange(input) {
    if (input === void 0) { input = {}; }
    if (input.from && input.to && input.from > input.to) {
        throw new Error("End date must be greater than or equal to start date.");
    }
    var to = (0, date_fns_1.endOfDay)(input.to || new Date());
    var from = (0, date_fns_1.startOfDay)(input.from || (0, date_fns_1.subDays)(to, 30));
    return {
        from: from,
        to: to
    };
}
