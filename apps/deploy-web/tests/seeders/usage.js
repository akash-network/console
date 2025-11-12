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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUsageHistoryStats = exports.buildUsageHistory = exports.buildUsageHistoryItem = void 0;
var faker_1 = require("@faker-js/faker");
var buildUsageHistoryItem = function (_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.date, date = _c === void 0 ? faker_1.faker.date.past() : _c, _d = _b.activeDeployments, activeDeployments = _d === void 0 ? faker_1.faker.number.int({ min: 0, max: 10 }) : _d, _e = _b.dailyAktSpent, dailyAktSpent = _e === void 0 ? faker_1.faker.number.int({ min: 0, max: 100 }) : _e, _f = _b.totalAktSpent, totalAktSpent = _f === void 0 ? faker_1.faker.number.int({ min: 0, max: 1000 }) : _f, _g = _b.dailyUsdcSpent, dailyUsdcSpent = _g === void 0 ? faker_1.faker.number.int({ min: 0, max: 100 }) : _g, _h = _b.totalUsdcSpent, totalUsdcSpent = _h === void 0 ? faker_1.faker.number.int({ min: 0, max: 1000 }) : _h, _j = _b.dailyUsdSpent, dailyUsdSpent = _j === void 0 ? faker_1.faker.number.int({ min: 0, max: 100 }) : _j, _k = _b.totalUsdSpent, totalUsdSpent = _k === void 0 ? faker_1.faker.number.int({ min: 0, max: 1000 }) : _k;
    return {
        date: date instanceof Date ? date.toISOString().split("T")[0] : date,
        activeDeployments: activeDeployments,
        dailyAktSpent: dailyAktSpent,
        totalAktSpent: totalAktSpent,
        dailyUsdcSpent: dailyUsdcSpent,
        totalUsdcSpent: totalUsdcSpent,
        dailyUsdSpent: dailyUsdSpent,
        totalUsdSpent: totalUsdSpent
    };
};
exports.buildUsageHistoryItem = buildUsageHistoryItem;
var buildUsageHistory = function (overrides, count) {
    if (overrides === void 0) { overrides = []; }
    var numberOfItems = count !== null && count !== void 0 ? count : faker_1.faker.number.int({ min: 1, max: 10 });
    return Array.from({ length: numberOfItems }, function () {
        return (0, exports.buildUsageHistoryItem)(overrides.length > 0 ? faker_1.faker.helpers.arrayElement(overrides) : {});
    });
};
exports.buildUsageHistory = buildUsageHistory;
var buildUsageHistoryStats = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ totalSpent: faker_1.faker.number.int({ min: 0, max: 10000 }), averageSpentPerDay: faker_1.faker.number.float({ min: 0, max: 100 }), totalDeployments: faker_1.faker.number.int({ min: 0, max: 100 }), averageDeploymentsPerDay: faker_1.faker.number.float({ min: 0, max: 10 }) }, overrides);
};
exports.buildUsageHistoryStats = buildUsageHistoryStats;
