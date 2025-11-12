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
exports.buildApiKeys = exports.buildApiKey = void 0;
var faker_1 = require("@faker-js/faker");
var buildApiKey = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: faker_1.faker.string.uuid(), name: faker_1.faker.company.name(), expiresAt: faker_1.faker.date.future().toISOString(), createdAt: faker_1.faker.date.past().toISOString(), updatedAt: faker_1.faker.date.recent().toISOString(), lastUsedAt: faker_1.faker.date.recent().toISOString(), keyFormat: "ac.sk.test.".concat(faker_1.faker.string.alphanumeric(15)) }, overrides));
};
exports.buildApiKey = buildApiKey;
var buildApiKeys = function (count, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return Array.from({ length: count }, function () { return (0, exports.buildApiKey)(overrides); });
};
exports.buildApiKeys = buildApiKeys;
