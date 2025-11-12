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
exports.expect = exports.test = void 0;
var test_1 = require("@playwright/test");
var nanoid_1 = require("nanoid");
var path_1 = require("path");
var selectChainNetwork_1 = require("../actions/selectChainNetwork");
var base_test_1 = require("./base-test");
var test_env_config_1 = require("./test-env.config");
var wallet_setup_1 = require("./wallet-setup");
// @see https://playwright.dev/docs/chrome-extensions
exports.test = base_test_1.test.extend({
    // eslint-disable-next-line no-empty-pattern
    context: function (_a, use_1) { return __awaiter(void 0, [_a, use_1], void 0, function (_b, use) {
        var pathToExtension, contextName, userDataDir, args, context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    pathToExtension = path_1.default.join(__dirname, "Leap");
                    contextName = (0, nanoid_1.nanoid)();
                    userDataDir = path_1.default.join(__dirname, "testdata", "tmp", contextName);
                    args = [
                        // keep new line
                        "--disable-extensions-except=".concat(pathToExtension),
                        "--load-extension=".concat(pathToExtension)
                    ];
                    return [4 /*yield*/, test_1.chromium.launchPersistentContext(userDataDir, {
                            channel: "chromium",
                            args: args,
                            permissions: ["clipboard-read", "clipboard-write"]
                        })];
                case 1:
                    context = _c.sent();
                    return [4 /*yield*/, use(context)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, context.close()];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    extensionId: function (_a, use_1) { return __awaiter(void 0, [_a, use_1], void 0, function (_b, use) {
        var background, extensionId;
        var context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    background = context.serviceWorkers()[0];
                    if (!!background) return [3 /*break*/, 2];
                    return [4 /*yield*/, context.waitForEvent("serviceworker")];
                case 1:
                    background = _c.sent();
                    _c.label = 2;
                case 2:
                    extensionId = background.url().split("/")[2];
                    return [4 /*yield*/, use(extensionId)];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    page: [
        function (_a, use_1) { return __awaiter(void 0, [_a, use_1], void 0, function (_b, use) {
            var _c, extPage, page, _d;
            var context = _b.context, extensionId = _b.extensionId;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, context.waitForEvent("page", { timeout: 5000 })];
                    case 1:
                        _e.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _c = _e.sent();
                        return [3 /*break*/, 3];
                    case 3: return [4 /*yield*/, (0, wallet_setup_1.getExtensionPage)(context, extensionId)];
                    case 4:
                        extPage = _e.sent();
                        return [4 /*yield*/, (0, wallet_setup_1.setupWallet)(context, extPage)];
                    case 5:
                        _e.sent();
                        return [4 /*yield*/, extPage.close()];
                    case 6:
                        _e.sent();
                        return [4 /*yield*/, context.newPage()];
                    case 7:
                        page = _e.sent();
                        return [4 /*yield*/, (0, base_test_1.injectUIConfig)(page)];
                    case 8:
                        _e.sent();
                        if (!(test_env_config_1.testEnvConfig.NETWORK_ID !== "mainnet")) return [3 /*break*/, 17];
                        _e.label = 9;
                    case 9:
                        _e.trys.push([9, 14, , 17]);
                        return [4 /*yield*/, page.goto(test_env_config_1.testEnvConfig.BASE_URL)];
                    case 10:
                        _e.sent();
                        return [4 /*yield*/, (0, wallet_setup_1.connectWalletViaLeap)(context, page)];
                    case 11:
                        _e.sent();
                        return [4 /*yield*/, (0, selectChainNetwork_1.selectChainNetwork)(page, test_env_config_1.testEnvConfig.NETWORK_ID)];
                    case 12:
                        _e.sent();
                        return [4 /*yield*/, (0, wallet_setup_1.connectWalletViaLeap)(context, page)];
                    case 13:
                        _e.sent();
                        return [3 /*break*/, 17];
                    case 14:
                        _d = _e.sent();
                        // Fallback in case the default network is non-functional.
                        //  E.g., during network upgrade when sandbox is already on a different version from mainnet
                        return [4 /*yield*/, page.goto("".concat(test_env_config_1.testEnvConfig.BASE_URL, "?network=").concat(test_env_config_1.testEnvConfig.NETWORK_ID))];
                    case 15:
                        // Fallback in case the default network is non-functional.
                        //  E.g., during network upgrade when sandbox is already on a different version from mainnet
                        _e.sent();
                        return [4 /*yield*/, (0, wallet_setup_1.awaitWalletAndApprove)(context, page, extensionId)];
                    case 16:
                        _e.sent();
                        return [3 /*break*/, 17];
                    case 17: return [4 /*yield*/, use(page)];
                    case 18:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        { scope: "test", timeout: 5 * 60 * 1000 }
    ]
});
exports.expect = exports.test.expect;
