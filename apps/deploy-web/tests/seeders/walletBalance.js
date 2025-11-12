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
exports.buildWalletBalance = void 0;
var faker_1 = require("@faker-js/faker");
var buildWalletBalance = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ totalUsd: faker_1.faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }), balanceUAKT: faker_1.faker.number.int({ min: 0, max: 1000000 }), balanceUUSDC: faker_1.faker.number.int({ min: 0, max: 1000000 }), totalUAKT: faker_1.faker.number.int({ min: 0, max: 1000000 }), totalUUSDC: faker_1.faker.number.int({ min: 0, max: 1000000 }), totalDeploymentEscrowUAKT: faker_1.faker.number.int({ min: 0, max: 100000 }), totalDeploymentEscrowUUSDC: faker_1.faker.number.int({ min: 0, max: 100000 }), totalDeploymentEscrowUSD: faker_1.faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }), totalDeploymentGrantsUAKT: faker_1.faker.number.int({ min: 0, max: 100000 }), totalDeploymentGrantsUUSDC: faker_1.faker.number.int({ min: 0, max: 100000 }), totalDeploymentGrantsUSD: faker_1.faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }) }, overrides));
};
exports.buildWalletBalance = buildWalletBalance;
