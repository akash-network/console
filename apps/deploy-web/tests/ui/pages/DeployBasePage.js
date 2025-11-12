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
exports.DeployBasePage = void 0;
var test_1 = require("@playwright/test");
var test_env_config_1 = require("../fixture/test-env.config");
var DeployBasePage = /** @class */ (function () {
    function DeployBasePage(context, page, path, cardTestId) {
        if (context === void 0) { context = context; }
        this.context = context;
        this.page = page;
        this.path = path;
        this.cardTestId = cardTestId;
        this.feeType = "low";
    }
    DeployBasePage.prototype.goto = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.goto("".concat(test_env_config_1.testEnvConfig.BASE_URL, "/").concat(this.path))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DeployBasePage.prototype.gotoInteractive = function (skipInit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.cardTestId) return [3 /*break*/, 5];
                        if (!!skipInit) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.page.goto(test_env_config_1.testEnvConfig.BASE_URL)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.page.getByTestId("sidebar-deploy-button").first().click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByTestId(this.cardTestId).click()];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    DeployBasePage.prototype.generateSSHKeys = function () {
        return __awaiter(this, void 0, void 0, function () {
            var downloadPromise;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        downloadPromise = this.page.waitForEvent("download");
                        return [4 /*yield*/, this.page.getByTestId("generate-ssh-keys-btn").click()];
                    case 1:
                        _b.sent();
                        _a = {};
                        return [4 /*yield*/, downloadPromise];
                    case 2: return [2 /*return*/, (_a.download = _b.sent(),
                            _a.input = this.page.getByTestId("ssh-public-key-input"),
                            _a)];
                }
            });
        });
    };
    DeployBasePage.prototype.createDeployment = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.getByTestId("create-deployment-btn").click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByTestId("deposit-modal-continue-button").click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DeployBasePage.prototype.createLease = function (providerName) {
        return __awaiter(this, void 0, void 0, function () {
            var providers;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!providerName) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.page.getByLabel(providerName).click()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 2:
                        providers = test_env_config_1.PROVIDERS_WHITELIST[test_env_config_1.testEnvConfig.NETWORK_ID];
                        if (!!providers.length) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.page.getByRole("radio", { checked: false }).click()];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, Promise.race(providers.map(function (provider) {
                            return _this.page
                                .getByLabel(provider)
                                .click()
                                .catch(function () { return null; });
                        }))];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [4 /*yield*/, this.page.getByTestId("create-lease-button").click()];
                    case 7:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DeployBasePage.prototype.validateLease = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.waitForURL(new RegExp("".concat(test_env_config_1.testEnvConfig.BASE_URL, "/deployments/\\d+")))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(this.page.getByText("SuccessfulCreate", { exact: true })).toBeVisible({ timeout: 10000 })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByRole("tab", { name: /Leases/i }).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByLabel(/URIs/i).getByRole("link").first().isVisible()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(this.page.getByTestId("lease-row-0-state")).toHaveText("active")];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DeployBasePage.prototype.closeDeploymentDetail = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.page.getByTestId("deployment-detail-dropdown").click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByTestId("deployment-detail-close-button").click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DeployBasePage.prototype.signTransaction = function () {
        return __awaiter(this, arguments, void 0, function (feeType) {
            var popupPage;
            if (feeType === void 0) { feeType = this.feeType; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.context.waitForEvent("page")];
                    case 1:
                        popupPage = _a.sent();
                        return [4 /*yield*/, popupPage.waitForLoadState("domcontentloaded")];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, popupPage.locator("input[name=\"fee\"][type=\"radio\"][value=\"".concat(feeType, "\"]")).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, popupPage.getByRole("button", { name: "Approve" }).click()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.page.getByText(/Transaction success/).waitFor({ state: "visible", timeout: 10000 })];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return DeployBasePage;
}());
exports.DeployBasePage = DeployBasePage;
