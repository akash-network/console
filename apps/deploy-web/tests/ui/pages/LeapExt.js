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
exports.LeapExt = void 0;
var faker_1 = require("@faker-js/faker");
var timer_1 = require("@src/utils/timer");
var test_env_config_1 = require("../fixture/test-env.config");
var testing_helpers_1 = require("../fixture/testing-helpers");
var wallet_setup_1 = require("../fixture/wallet-setup");
var LeapExt = /** @class */ (function () {
    function LeapExt(context, page) {
        this.context = context;
        this.page = page;
    }
    LeapExt.prototype.goto = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.goto("".concat(test_env_config_1.testEnvConfig.BASE_URL))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    LeapExt.prototype.createWallet = function (extensionId) {
        return __awaiter(this, void 0, void 0, function () {
            var newWalletName, popup;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        newWalletName = faker_1.faker.word.adjective();
                        return [4 /*yield*/, (0, wallet_setup_1.createWallet)(this.context, extensionId, newWalletName)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, Promise.all([
                                this.context.waitForEvent("page"),
                                (0, timer_1.wait)(100).then(function () {
                                    _this.page.reload({ waitUntil: "domcontentloaded" });
                                })
                            ])];
                    case 2:
                        popup = (_a.sent())[0];
                        return [4 /*yield*/, (0, testing_helpers_1.clickConnectWalletButton)(popup)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, newWalletName];
                }
            });
        });
    };
    LeapExt.prototype.disconnectWallet = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.getByLabel("Connected wallet name and balance").hover()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByRole("button", { name: "Disconnect Wallet" }).click()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.page.reload({ waitUntil: "domcontentloaded" })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    LeapExt.prototype.acceptTransaction = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var popupPage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, context.waitForEvent("page", { timeout: 5000 })];
                    case 1:
                        popupPage = _a.sent();
                        return [4 /*yield*/, (0, wallet_setup_1.approveWalletOperation)(popupPage)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return LeapExt;
}());
exports.LeapExt = LeapExt;
