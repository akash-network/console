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
var base_test_1 = require("./fixture/base-test");
var BuildTemplatePage_1 = require("./pages/BuildTemplatePage");
base_test_1.test.describe("SDL Builder Deployment Flow", function () {
    (0, base_test_1.test)("navigate to SDL builder page", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getDeployButton()).toBeVisible()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewButton()).toBeVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getAddServiceButton()).toBeVisible()];
                case 4:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("fill image name and preview SDL", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context, imageName: "nginx:latest" })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    return [4 /*yield*/, sdlBuilderPage.clickPreview()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("nginx:latest")).toBeVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("version:")).toBeVisible()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("services:")).toBeVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.closePreview()];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("create deployment from SDL builder", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context, imageName: "nginx:alpine" })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    return [4 /*yield*/, sdlBuilderPage.clickDeploy()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(page.getByTestId("connect-wallet-btn").first()).toBeVisible({ timeout: 10000 })];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("add multiple services", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context, imageName: "nginx:latest" })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    return [4 /*yield*/, sdlBuilderPage.addService()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.waitForServiceAdded("service-2")];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.clickPreview()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("service-1")).toBeVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("service-2")).toBeVisible()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.closePreview()];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("preview SDL with different images", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage, images, _i, images_1, image;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    images = ["postgres:15", "redis:7", "node:18-alpine"];
                    _i = 0, images_1 = images;
                    _c.label = 2;
                case 2:
                    if (!(_i < images_1.length)) return [3 /*break*/, 8];
                    image = images_1[_i];
                    return [4 /*yield*/, sdlBuilderPage.fillImageName(image)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.clickPreview()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator(image)).toBeVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.closePreview()];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 2];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("verify SDL YAML structure", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context, imageName: "ubuntu:22.04" })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    return [4 /*yield*/, sdlBuilderPage.clickPreview()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("version:")).toBeVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("services:")).toBeVisible()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("profiles:")).toBeVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewTextLocator("deployment:")).toBeVisible()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.closePreview()];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("add service then preview shows both services", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, setup({ page: page, context: context, imageName: "nginx:latest" })];
                case 1:
                    sdlBuilderPage = (_c.sent()).sdlBuilderPage;
                    return [4 /*yield*/, sdlBuilderPage.addService()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.waitForServiceAdded("service-2")];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.clickPreview()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getServiceLocator("service-1")).toBeVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getServiceLocator("service-2")).toBeVisible()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.closePreview()];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, base_test_1.test)("preview button always available with valid image", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sdlBuilderPage;
        var page = _b.page, context = _b.context;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    sdlBuilderPage = new BuildTemplatePage_1.BuildTemplatePage(context, page, "sdl-builder");
                    return [4 /*yield*/, sdlBuilderPage.gotoInteractive()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, sdlBuilderPage.fillImageName("alpine:latest")];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, base_test_1.expect)(sdlBuilderPage.getPreviewButton()).toBeEnabled()];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var sdlBuilderPage;
            var page = _b.page, context = _b.context, imageName = _b.imageName;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        sdlBuilderPage = new BuildTemplatePage_1.BuildTemplatePage(context, page, "sdl-builder");
                        return [4 /*yield*/, sdlBuilderPage.gotoInteractive()];
                    case 1:
                        _c.sent();
                        if (!imageName) return [3 /*break*/, 3];
                        return [4 /*yield*/, sdlBuilderPage.fillImageName(imageName)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3: return [2 /*return*/, { sdlBuilderPage: sdlBuilderPage }];
                }
            });
        });
    }
});
