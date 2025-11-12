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
exports.buildManagedWallet = void 0;
var faker_1 = require("@faker-js/faker");
var buildManagedWallet = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: faker_1.faker.string.uuid(), userId: faker_1.faker.string.uuid(), address: "akash".concat(faker_1.faker.string.alphanumeric({ length: 39 })), isTrialing: faker_1.faker.datatype.boolean(), creditAmount: faker_1.faker.number.int({ min: 0, max: 1000 }), username: "Managed Wallet", isWalletConnected: true, createdAt: faker_1.faker.date.past() }, overrides));
};
exports.buildManagedWallet = buildManagedWallet;
