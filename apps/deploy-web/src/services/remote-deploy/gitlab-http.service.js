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
exports.GitLabService = void 0;
var browser_env_config_1 = require("@src/config/browser-env.config");
var GitLabService = /** @class */ (function () {
    function GitLabService(internalApiService, createHttpClient) {
        this.internalApiService = internalApiService;
        this.gitlabApiService = createHttpClient({
            baseURL: "https://gitlab.com/api/v4",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            }
        });
    }
    GitLabService.prototype.loginWithGitLab = function () {
        window.location.href = "https://gitlab.com/oauth/authorize?client_id=".concat(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GITLAB_CLIENT_ID, "&redirect_uri=").concat(process.env.NEXT_PUBLIC_REDIRECT_URI, "&response_type=code&scope=read_user+read_repository+read_api+api&state=gitlab");
    };
    GitLabService.prototype.fetchAccessToken = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.internalApiService.post("/api/gitlab/authenticate", { code: code })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.refreshToken = function (refreshToken) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.internalApiService.post("/api/gitlab/refresh", { refreshToken: refreshToken })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchUserProfile = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/user", {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchGitLabGroups = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/groups", {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchReposByGroup = function (group, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/groups/".concat(group, "/projects"), {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchBranches = function (repo, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/projects/".concat(repo, "/repository/branches"), {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchCommits = function (repo, branch, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/projects/".concat(repo, "/repository/commits?ref_name=").concat(branch), {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchPackageJson = function (repo, subFolder, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/projects/".concat(repo, "/repository/files/").concat(subFolder ? "".concat(subFolder, "%2F") : "", "package.json?ref=main"), {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    GitLabService.prototype.fetchSrcFolders = function (repo, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.gitlabApiService.get("/projects/".concat(repo, "/repository/tree"), {
                            headers: {
                                Authorization: "Bearer ".concat(token)
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    return GitLabService;
}());
exports.GitLabService = GitLabService;
