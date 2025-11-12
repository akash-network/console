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
var faker_1 = require("@faker-js/faker");
var jest_mock_extended_1 = require("jest-mock-extended");
var useGithubQuery_1 = require("./useGithubQuery");
var react_1 = require("@testing-library/react");
var query_client_1 = require("@tests/unit/query-client");
var token_1 = require("@tests/unit/token");
describe("useGithubQuery", function () {
    describe("useFetchAccessToken", function () {
        it("fetches access token and update token state", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, mockGithubService, onSuccess, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchAccessToken: jest.fn().mockResolvedValue(mockData)
                        });
                        onSuccess = jest.fn();
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useFetchAccessToken)(onSuccess); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, result.current.mutateAsync("test-code")];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockGithubService.fetchAccessToken).toHaveBeenCalledWith("test-code");
                                expect(onSuccess).toHaveBeenCalled();
                                expect((0, token_1.readToken)()).toBe(mockData.accessToken);
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useUserProfile", function () {
        it("fetches user profile when token is available", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, mockGithubService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, token_1.writeToken)({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
                        mockData = { username: "test-username" };
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchUserProfile: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useUserProfile)(); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useRepos", function () {
        it("fetches repos when token is available", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, mockGithubService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, token_1.writeToken)({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
                        mockData = [{ name: faker_1.faker.lorem.word() }];
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchRepos: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useRepos)(); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockGithubService.fetchRepos).toHaveBeenCalledWith("test-token");
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useBranches", function () {
        it("fetches branches when repo is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, mockGithubService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, token_1.writeToken)({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
                        mockData = [{ name: faker_1.faker.lorem.word() }];
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchBranches: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useBranches)("test-repo"); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockGithubService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not fetch when repo is not provided", function () {
            var result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useBranches)(); }).result;
            expect(result.current.isLoading).toBe(false);
        });
    });
    describe("useCommits", function () {
        it("fetches commits when repo and branch are provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, mockGithubService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, token_1.writeToken)({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
                        mockData = [{ sha: faker_1.faker.git.commitSha() }];
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchCommits: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useCommits)("test-repo", "main"); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockGithubService.fetchCommits).toHaveBeenCalledWith("test-repo", "main", "test-token");
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not fetch when repo or branch is not provided", function () {
            var result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useCommits)(); }).result;
            expect(result.current.isLoading).toBe(false);
        });
    });
    describe("usePackageJson", function () {
        it("fetches package.json and call onSuccess callback", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockPackageJson, onSuccess, mockGithubService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, token_1.writeToken)({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
                        mockPackageJson = { content: btoa(JSON.stringify({ dependencies: ["foo", "bar"] })) };
                        onSuccess = jest.fn();
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchPackageJson: jest.fn().mockResolvedValue(mockPackageJson)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.usePackageJson)(onSuccess, "test-repo", "src"); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockGithubService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "src", "test-token");
                                expect(result.current.isSuccess).toBe(true);
                                expect(onSuccess).toHaveBeenCalledWith({ dependencies: ["foo", "bar"] });
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useSrcFolders", function () {
        it("fetches source folders and call onSettled callback", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockFolders, onSettled, mockGithubService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, token_1.writeToken)({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
                        mockFolders = [{ name: faker_1.faker.lorem.word() }];
                        onSettled = jest.fn();
                        mockGithubService = (0, jest_mock_extended_1.mock)({
                            fetchSrcFolders: jest.fn().mockResolvedValue(mockFolders)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGithubQuery_1.useSrcFolders)(onSettled, "test-repo"); }, {
                            services: {
                                githubService: function () { return mockGithubService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockGithubService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "test-token");
                                expect(result.current.isSuccess).toBe(true);
                                expect(onSettled).toHaveBeenCalledWith(mockFolders);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
