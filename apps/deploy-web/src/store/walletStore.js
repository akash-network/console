"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jotai_1 = require("jotai");
var utils_1 = require("jotai/utils");
var isSignedInWithTrial = (0, utils_1.atomWithStorage)("isSignedInWithTrial", false);
var selectedWalletType = (0, utils_1.atomWithStorage)("selectedWalletType", "custodial");
var isWalletModalOpen = (0, jotai_1.atom)(false);
var balance = (0, jotai_1.atom)(null);
var walletStore = {
    isSignedInWithTrial: isSignedInWithTrial,
    selectedWalletType: selectedWalletType,
    isWalletModalOpen: isWalletModalOpen,
    balance: balance
};
exports.default = walletStore;
