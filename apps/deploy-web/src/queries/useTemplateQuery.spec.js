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
var client_1 = require("@auth0/nextjs-auth0/client");
var jest_mock_extended_1 = require("jest-mock-extended");
var CustomSnackbarProvider_1 = require("../../../../packages/ui/context/CustomSnackbarProvider");
var query_client_1 = require("../../tests/unit/query-client");
var useTemplateQuery_1 = require("./useTemplateQuery");
var react_1 = require("@testing-library/react");
var mockTemplate = {
    id: "template-1",
    title: "Test Template",
    description: "Test Description",
    sdl: "version: '2.0'",
    isPublic: true,
    cpu: 1000,
    ram: 1024,
    storage: 2048,
    username: "test-user",
    isFavorite: false,
    userId: "user-123"
};
var mockTemplateCategory = {
    title: "Web Applications",
    templates: [
        {
            id: "template-1",
            title: "Test Template",
            description: "Test Description",
            githubUrl: "https://github.com/test",
            summary: "Test summary",
            readme: "Test readme",
            deploy: "Test deploy",
            guide: "Test guide",
            logoUrl: "https://example.com/logo.png",
            persistentStorageEnabled: false,
            category: "Web Applications"
        }
    ]
};
describe("useTemplateQuery", function () {
    describe(useTemplateQuery_1.useUserTemplates.name, function () {
        it("fetches user templates successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.get.mockResolvedValue({ data: [mockTemplate] });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useUserTemplates)("test-user"); }, {
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/user/templates/test-user");
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual([mockTemplate]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when fetching user templates", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.get.mockRejectedValue(new Error("Failed to fetch templates"));
                        result = (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useUserTemplates)("test-user"); }, {
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return expect(result.current.isError).toBe(true); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useUserFavoriteTemplates", function () {
        it("fetches user favorite templates successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, favoriteTemplates, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        favoriteTemplates = [{ id: "template-1", title: "Favorite Template" }];
                        consoleApiHttpClient.get.mockResolvedValue({ data: favoriteTemplates });
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/user/favoriteTemplates");
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(favoriteTemplates);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when fetching user favorite templates", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.get.mockRejectedValue(new Error("Failed to fetch favorite templates"));
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useUserFavoriteTemplates)(); }, {
                services: input === null || input === void 0 ? void 0 : input.services,
                wrapper: function (_a) {
                    var children = _a.children;
                    return <client_1.UserProvider user={(input === null || input === void 0 ? void 0 : input.user) || { email: "test@akash.network" }}>{children}</client_1.UserProvider>;
                }
            });
        }
    });
    describe(useTemplateQuery_1.useTemplate.name, function () {
        it("fetches single template successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.get.mockResolvedValue({ data: mockTemplate });
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/user/template/template-1");
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockTemplate);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when fetching single template", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.get.mockRejectedValue(new Error("Template not found"));
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useTemplate)((input === null || input === void 0 ? void 0 : input.templateId) || "template-1"); }, {
                services: input === null || input === void 0 ? void 0 : input.services
            });
        }
    });
    describe(useTemplateQuery_1.useSaveUserTemplate.name, function () {
        it("saves template successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result, templateData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.post.mockResolvedValue({ data: "saved-template-id" });
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        templateData = {
                            title: "New Template",
                            sdl: "version: '2.0'",
                            isPublic: true
                        };
                        (0, react_1.act)(function () { return result.current.mutate(templateData); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/user/saveTemplate", {
                                    id: undefined,
                                    sdl: "version: '2.0'",
                                    isPublic: true,
                                    title: "New Template",
                                    description: undefined,
                                    cpu: undefined,
                                    ram: undefined,
                                    storage: undefined
                                });
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when saving template", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result, templateData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.post.mockRejectedValue(new Error("Failed to save template"));
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        templateData = { title: "New Template", sdl: "version: '2.0'" };
                        (0, react_1.act)(function () { return result.current.mutate(templateData); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useSaveUserTemplate)(); }, {
                services: input === null || input === void 0 ? void 0 : input.services
            });
        }
    });
    describe(useTemplateQuery_1.useDeleteTemplate.name, function () {
        it("deletes template successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.delete.mockResolvedValue({});
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(consoleApiHttpClient.delete).toHaveBeenCalledWith("/user/deleteTemplate/template-1");
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when deleting template", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.delete.mockRejectedValue(new Error("Failed to delete template"));
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useDeleteTemplate)((input === null || input === void 0 ? void 0 : input.templateId) || "template-1"); }, {
                services: input === null || input === void 0 ? void 0 : input.services,
                wrapper: function (_a) {
                    var children = _a.children;
                    return <client_1.UserProvider user={{ email: "test@example.com" }}>{children}</client_1.UserProvider>;
                }
            });
        }
    });
    describe("useAddFavoriteTemplate", function () {
        it("adds favorite template successfully and shows snackbar", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.post.mockResolvedValue({});
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return __awaiter(void 0, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/user/addFavoriteTemplate/template-1");
                                            expect(result.current.isSuccess).toBe(true);
                                            _a = expect;
                                            return [4 /*yield*/, react_1.screen.findByText(/Favorite added!/i)];
                                        case 1:
                                            _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when adding favorite template", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.post.mockRejectedValue(new Error("Failed to add favorite"));
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useAddFavoriteTemplate)((input === null || input === void 0 ? void 0 : input.templateId) || "template-1"); }, {
                services: input === null || input === void 0 ? void 0 : input.services,
                wrapper: function (_a) {
                    var children = _a.children;
                    return <CustomSnackbarProvider_1.CustomSnackbarProvider>{children}</CustomSnackbarProvider_1.CustomSnackbarProvider>;
                }
            });
        }
    });
    describe("useRemoveFavoriteTemplate", function () {
        it("removes favorite template successfully and shows snackbar", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.delete.mockResolvedValue({});
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () { return __awaiter(void 0, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            expect(consoleApiHttpClient.delete).toHaveBeenCalledWith("/user/removeFavoriteTemplate/template-1");
                                            expect(result.current.isSuccess).toBe(true);
                                            _a = expect;
                                            return [4 /*yield*/, react_1.screen.findByText(/Favorite removed/i)];
                                        case 1:
                                            _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when removing favorite template", function () { return __awaiter(void 0, void 0, void 0, function () {
            var consoleApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        consoleApiHttpClient = (0, jest_mock_extended_1.mock)();
                        consoleApiHttpClient.delete.mockRejectedValue(new Error("Failed to remove favorite"));
                        result = setup({
                            services: {
                                consoleApiHttpClient: function () { return consoleApiHttpClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () { return result.current.mutate(); });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isError).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useRemoveFavoriteTemplate)((input === null || input === void 0 ? void 0 : input.templateId) || "template-1"); }, {
                services: input === null || input === void 0 ? void 0 : input.services,
                wrapper: function (_a) {
                    var children = _a.children;
                    return <CustomSnackbarProvider_1.CustomSnackbarProvider>{children}</CustomSnackbarProvider_1.CustomSnackbarProvider>;
                }
            });
        }
    });
    describe("useTemplates", function () {
        it("fetches templates grouped by category successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var templateService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateService = (0, jest_mock_extended_1.mock)({
                            findGroupedByCategory: jest.fn().mockResolvedValue({
                                data: [mockTemplateCategory]
                            })
                        });
                        result = setup({
                            services: {
                                template: function () { return templateService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(templateService.findGroupedByCategory).toHaveBeenCalled();
                                expect(result.current.categories).toHaveLength(1);
                                expect(result.current.templates).toHaveLength(1);
                                expect(result.current.categories[0].title).toBe("Web Applications");
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles empty response when fetching templates", function () { return __awaiter(void 0, void 0, void 0, function () {
            var templateService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateService = (0, jest_mock_extended_1.mock)({
                            findGroupedByCategory: jest.fn().mockResolvedValue({
                                data: null
                            })
                        });
                        result = setup({
                            services: {
                                template: function () { return templateService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(templateService.findGroupedByCategory).toHaveBeenCalled();
                                expect(result.current.categories).toEqual([]);
                                expect(result.current.templates).toEqual([]);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles error when fetching templates", function () { return __awaiter(void 0, void 0, void 0, function () {
            var templateService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        templateService = (0, jest_mock_extended_1.mock)({
                            findGroupedByCategory: jest.fn().mockRejectedValue(new Error("Failed to fetch templates"))
                        });
                        result = setup({
                            services: {
                                template: function () { return templateService; }
                            }
                        }).result;
                        expect(result.current.isLoading).toBe(true);
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.categories).toEqual([]);
                                expect(result.current.templates).toEqual([]);
                                expect(result.current.isLoading).toBe(false);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        function setup(input) {
            return (0, query_client_1.setupQuery)(function () { return (0, useTemplateQuery_1.useTemplates)(); }, {
                services: input === null || input === void 0 ? void 0 : input.services
            });
        }
    });
});
