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
exports.buildWallet = exports.genWalletAddress = void 0;
var faker_1 = require("@faker-js/faker");
var genWalletAddress = function () { return "akash".concat(faker_1.faker.string.alphanumeric({ length: 39 })); };
exports.genWalletAddress = genWalletAddress;
var buildWallet = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ address: (0, exports.genWalletAddress)(), walletName: faker_1.faker.internet.username(), isWalletConnected: true, isWalletLoaded: true, connectManagedWallet: jest.fn(), logout: jest.fn(), signAndBroadcastTx: jest.fn(), isManaged: true, isCustodial: false, isWalletLoading: false, isTrialing: false, isOnboarding: false, creditAmount: faker_1.faker.number.float({ min: 0, max: 1000 }), switchWalletType: jest.fn(), hasManagedWallet: true, managedWalletError: undefined }, overrides));
};
exports.buildWallet = buildWallet;
