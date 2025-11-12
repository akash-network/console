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
var components_1 = require("@akashnetwork/ui/components");
var context_with_extension_1 = require("./fixture/context-with-extension");
var testing_helpers_1 = require("./fixture/testing-helpers");
var wallet_setup_1 = require("./fixture/wallet-setup");
var AuthorizationsPage_1 = require("./pages/AuthorizationsPage");
var LeapExt_1 = require("./pages/LeapExt");
var runAuthorizationTest = function (_a) {
    var name = _a.name, buttonLabel = _a.buttonLabel, listLabel = _a.listLabel;
    context_with_extension_1.test.describe("".concat(name, " Authorizations"), function () {
        (0, context_with_extension_1.test)("can authorize spending", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var _c, authorizationsPage, address, shortenedAddress, grantList;
            var page = _b.page, context = _b.context, extensionId = _b.extensionId;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        context_with_extension_1.test.setTimeout(5 * 60 * 1000);
                        return [4 /*yield*/, setup({ page: page, context: context, extensionId: extensionId, buttonLabel: buttonLabel })];
                    case 1:
                        _c = _d.sent(), authorizationsPage = _c.authorizationsPage, address = _c.address;
                        shortenedAddress = (0, components_1.shortenAddress)(address);
                        grantList = authorizationsPage.page.getByLabel(listLabel);
                        return [4 /*yield*/, (0, context_with_extension_1.expect)(grantList.locator("tr", { hasText: shortenedAddress })).toBeVisible()];
                    case 2:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, context_with_extension_1.test)("can edit spending", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var _c, authorizationsPage, address, extension, grantList;
            var page = _b.page, context = _b.context, extensionId = _b.extensionId;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        context_with_extension_1.test.setTimeout(5 * 60 * 1000);
                        return [4 /*yield*/, setup({ page: page, context: context, extensionId: extensionId, buttonLabel: buttonLabel })];
                    case 1:
                        _c = _d.sent(), authorizationsPage = _c.authorizationsPage, address = _c.address, extension = _c.extension;
                        return [4 /*yield*/, authorizationsPage.editSpending(address, listLabel)];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, extension.acceptTransaction(context)];
                    case 3:
                        _d.sent();
                        grantList = authorizationsPage.page.getByLabel(listLabel);
                        return [4 /*yield*/, (0, context_with_extension_1.expect)(grantList.locator("tr", { hasText: "10.000000 AKT" })).toBeVisible()];
                    case 4:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, context_with_extension_1.test)("can revoke spending", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var _c, authorizationsPage, address, extension, shortenedAddress, grantList;
            var page = _b.page, context = _b.context, extensionId = _b.extensionId;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        context_with_extension_1.test.setTimeout(5 * 60 * 1000);
                        return [4 /*yield*/, setup({ page: page, context: context, extensionId: extensionId, buttonLabel: buttonLabel })];
                    case 1:
                        _c = _d.sent(), authorizationsPage = _c.authorizationsPage, address = _c.address, extension = _c.extension;
                        return [4 /*yield*/, authorizationsPage.revokeSpending(address, listLabel)];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, extension.acceptTransaction(context)];
                    case 3:
                        _d.sent();
                        shortenedAddress = (0, components_1.shortenAddress)(address);
                        grantList = authorizationsPage.page.getByLabel(listLabel);
                        return [4 /*yield*/, (0, context_with_extension_1.expect)(grantList.locator("tr", { hasText: shortenedAddress })).not.toBeVisible()];
                    case 4:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
};
runAuthorizationTest({ name: "Deployment", buttonLabel: "Authorize Spend", listLabel: "Deployment Authorization List" });
runAuthorizationTest({ name: "Tx Fee", buttonLabel: "Authorize Fee Spend", listLabel: "Tx Fee Authorization List" });
var setup = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var extension, address, _c, authorizationsPage;
    var page = _b.page, context = _b.context, extensionId = _b.extensionId, buttonLabel = _b.buttonLabel;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                extension = new LeapExt_1.LeapExt(context, page);
                _c = testing_helpers_1.clickCopyAddressButton;
                return [4 /*yield*/, (0, wallet_setup_1.getExtensionPage)(context, extensionId)];
            case 1: return [4 /*yield*/, _c.apply(void 0, [_d.sent()])];
            case 2:
                address = _d.sent();
                return [4 /*yield*/, extension.createWallet(extensionId)];
            case 3:
                _d.sent();
                authorizationsPage = new AuthorizationsPage_1.AuthorizationsPage(context, page);
                return [4 /*yield*/, authorizationsPage.goto()];
            case 4:
                _d.sent();
                return [4 /*yield*/, authorizationsPage.authorizeSpending(address, buttonLabel)];
            case 5:
                _d.sent();
                return [4 /*yield*/, extension.acceptTransaction(context)];
            case 6:
                _d.sent();
                return [2 /*return*/, {
                        authorizationsPage: authorizationsPage,
                        address: address,
                        extension: extension
                    }];
        }
    });
}); };
