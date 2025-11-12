"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtensionPage = getExtensionPage;
exports.setupWallet = setupWallet;
exports.createWallet = createWallet;
exports.connectWalletViaLeap = connectWalletViaLeap;
exports.awaitWalletAndApprove = awaitWalletAndApprove;
exports.approveWalletOperation = approveWalletOperation;
exports.restoreExtensionStorage = restoreExtensionStorage;
var net_1 = require("@akashnetwork/net");
var proto_signing_1 = require("@cosmjs/proto-signing");
var test_1 = require("@playwright/test");
var fs_1 = require("fs");
var path_1 = require("path");
var promises_1 = require("timers/promises");
var isWalletConnected_1 = require("../uiState/isWalletConnected");
var test_env_config_1 = require("./test-env.config");
var testing_helpers_1 = require("./testing-helpers");
var WALLET_PASSWORD = "12345678";
function getExtensionPage(context, extensionId) {
    return __awaiter(this, void 0, void 0, function () {
        var extUrl, extPage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    extUrl = "chrome-extension://".concat(extensionId, "/index.html");
                    extPage = context.pages().find(function (page) { return page.url().startsWith(extUrl); });
                    if (!!extPage) return [3 /*break*/, 5];
                    return [4 /*yield*/, context.newPage()];
                case 1:
                    extPage = _a.sent();
                    return [4 /*yield*/, extPage.goto(extUrl)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, extPage.waitForLoadState("domcontentloaded")];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, context.waitForEvent("page", { timeout: 5000 }).catch(function () { return null; })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, extPage];
            }
        });
    });
}
function setupWallet(context, page) {
    return __awaiter(this, void 0, void 0, function () {
        var wallet;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, importWalletToLeap(context, page)];
                case 1:
                    wallet = _a.sent();
                    return [4 /*yield*/, restoreExtensionStorage(page)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.reload({ waitUntil: "domcontentloaded" })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, topUpWallet(wallet)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createWallet(context, extensionId, walletName) {
    return __awaiter(this, void 0, void 0, function () {
        var extPage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getExtensionPage(context, extensionId)];
                case 1:
                    extPage = _a.sent();
                    return [4 /*yield*/, (0, testing_helpers_1.clickWalletSelectorDropdown)(extPage)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, testing_helpers_1.clickCreateNewWalletButton)(extPage)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, testing_helpers_1.fillWalletName)(extPage, walletName)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, (0, testing_helpers_1.clickCreateWalletButton)(extPage)];
            }
        });
    });
}
function connectWalletViaLeap(context, page) {
    return __awaiter(this, void 0, void 0, function () {
        var popupPage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, isWalletConnected_1.isWalletConnected)(page)];
                case 1:
                    if (!!(_a.sent())) return [3 /*break*/, 6];
                    return [4 /*yield*/, page.getByTestId("connect-wallet-btn").click()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, Promise.all([
                            context.waitForEvent("page", { timeout: 5000 }).catch(function () { return null; }),
                            (0, promises_1.setTimeout)(100).then(function () { return page.getByRole("button", { name: "Leap Leap" }).click(); })
                        ])];
                case 3:
                    popupPage = (_a.sent())[0];
                    return [4 /*yield*/, approveWalletOperation(popupPage)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, isWalletConnected_1.isWalletConnected)(page)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function awaitWalletAndApprove(context, page, extensionId) {
    return __awaiter(this, void 0, void 0, function () {
        var popupPage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.race([
                        context.waitForEvent("page", { timeout: 5000 }),
                        getExtensionPage(context, extensionId),
                    ])];
                case 1:
                    popupPage = _a.sent();
                    return [4 /*yield*/, approveWalletOperation(popupPage)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, isWalletConnected_1.isWalletConnected)(page)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function approveWalletOperation(popupPage) {
    return __awaiter(this, void 0, void 0, function () {
        var buttonsSelector, visibleButton, buttonText, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!popupPage)
                        return [2 /*return*/];
                    buttonsSelector = ['button:has-text("Approve")', 'button:has-text("Unlock wallet")', 'button:has-text("Connect")'].join(",");
                    return [4 /*yield*/, popupPage.waitForSelector(buttonsSelector, { state: "visible" })];
                case 1:
                    _b.sent();
                    // sometimes wallet extension is flikering and "Unlock wallet" button is visible for a split second
                    // so we need to wait again after a bit
                    return [4 /*yield*/, popupPage.waitForTimeout(500)];
                case 2:
                    // sometimes wallet extension is flikering and "Unlock wallet" button is visible for a split second
                    // so we need to wait again after a bit
                    _b.sent();
                    return [4 /*yield*/, popupPage.waitForSelector(buttonsSelector, { state: "visible" })];
                case 3:
                    visibleButton = _b.sent();
                    return [4 /*yield*/, visibleButton.textContent()];
                case 4:
                    buttonText = _b.sent();
                    _a = buttonText === null || buttonText === void 0 ? void 0 : buttonText.trim();
                    switch (_a) {
                        case "Approve": return [3 /*break*/, 5];
                        case "Unlock wallet": return [3 /*break*/, 7];
                        case "Connect": return [3 /*break*/, 11];
                    }
                    return [3 /*break*/, 13];
                case 5: return [4 /*yield*/, visibleButton.click()];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 14];
                case 7: return [4 /*yield*/, popupPage.locator("input").fill(WALLET_PASSWORD)];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, visibleButton.click()];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, popupPage.waitForSelector('button:has-text("Connect")', { state: "visible" }).then(function (button) { return button.click(); })];
                case 10:
                    _b.sent();
                    return [3 /*break*/, 14];
                case 11: return [4 /*yield*/, visibleButton.click()];
                case 12:
                    _b.sent();
                    return [3 /*break*/, 14];
                case 13: throw new Error("Unexpected state in wallet popup");
                case 14: return [2 /*return*/];
            }
        });
    });
}
function importWalletToLeap(context, page) {
    return __awaiter(this, void 0, void 0, function () {
        var mnemonic, mnemonicArray, _i, mnemonicArray_1, word;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mnemonic = test_env_config_1.testEnvConfig.TEST_WALLET_MNEMONIC;
                    if (!mnemonic) {
                        throw new Error("TEST_WALLET_MNEMONIC is not set");
                    }
                    mnemonicArray = mnemonic.trim().split(" ");
                    if (mnemonicArray.length !== 12) {
                        throw new Error("TEST_WALLET_MNEMONIC should have 12 words");
                    }
                    return [4 /*yield*/, page.getByText(/import an existing wallet/i).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.getByText(/recovery phrase/i).click()];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, , 16, 17]);
                    test_1.selectors.setTestIdAttribute("data-testing-id");
                    _i = 0, mnemonicArray_1 = mnemonicArray;
                    _a.label = 4;
                case 4:
                    if (!(_i < mnemonicArray_1.length)) return [3 /*break*/, 8];
                    word = mnemonicArray_1[_i];
                    return [4 /*yield*/, page.locator("input:focus").fill(word)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, page.keyboard.press("Tab")];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 4];
                case 8: return [4 /*yield*/, page.getByRole("button", { name: /Continue/i }).click()];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId("btn-select-wallet-proceed").click()];
                case 10:
                    _a.sent();
                    // Set password
                    return [4 /*yield*/, page.getByTestId("input-password").fill(WALLET_PASSWORD)];
                case 11:
                    // Set password
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId("input-confirm-password").fill(WALLET_PASSWORD)];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId("btn-password-proceed").click()];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, page.waitForLoadState("domcontentloaded")];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
                            prefix: "akash"
                        })];
                case 15: return [2 /*return*/, _a.sent()];
                case 16:
                    // Reset test id attribute for console
                    test_1.selectors.setTestIdAttribute("data-testid");
                    return [7 /*endfinally*/];
                case 17: return [2 /*return*/];
            }
        });
    });
}
function topUpWallet(wallet) {
    return __awaiter(this, void 0, void 0, function () {
        var accounts, balance, faucetUrl, response, _a, _b, _c, error_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, wallet.getAccounts()];
                case 1:
                    accounts = _d.sent();
                    return [4 /*yield*/, getBalance(accounts[0].address)];
                case 2:
                    balance = _d.sent();
                    if (balance > 100 * 1000000) {
                        // 100 AKT should be enough
                        return [2 /*return*/];
                    }
                    faucetUrl = net_1.netConfig.getFaucetUrl(test_env_config_1.testEnvConfig.NETWORK_ID);
                    if (!faucetUrl) {
                        console.error("Faucet URL is not set for this network: ".concat(test_env_config_1.testEnvConfig.NETWORK_ID, ". Cannot auto top up wallet"));
                        return [2 /*return*/];
                    }
                    if (faucetUrl.endsWith("/")) {
                        faucetUrl = faucetUrl.slice(0, -1);
                    }
                    return [4 /*yield*/, fetch("".concat(faucetUrl, "/faucet"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: "address=".concat(encodeURIComponent(accounts[0].address))
                        })];
                case 3:
                    response = _d.sent();
                    if (!(response.status >= 300)) return [3 /*break*/, 5];
                    console.error("Unexpected faucet response status: ".concat(response.status));
                    _b = (_a = console).error;
                    _c = ["Faucet response:"];
                    return [4 /*yield*/, response.text()];
                case 4:
                    _b.apply(_a, _c.concat([_d.sent()]));
                    _d.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _d.sent();
                    console.error("Unable to top up wallet");
                    console.error(error_1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function getBalance(address) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetch("".concat(net_1.netConfig.getBaseAPIUrl(test_env_config_1.testEnvConfig.NETWORK_ID), "/cosmos/bank/v1beta1/balances/").concat(address))];
                case 1:
                    response = _b.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _b.sent();
                    return [2 /*return*/, ((_a = data.balances.find(function (balance) { return balance.denom === "uakt"; })) === null || _a === void 0 ? void 0 : _a.amount) || 0];
            }
        });
    });
}
// @see https://github.com/microsoft/playwright/issues/14949
function restoreExtensionStorage(page) {
    return __awaiter(this, void 0, void 0, function () {
        var extensionStorage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    extensionStorage = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, "leapExtensionLocalStorage.json"), "utf8"));
                    return [4 /*yield*/, page.evaluate(function (data) { return chrome.storage.local.set(data); }, extensionStorage)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
