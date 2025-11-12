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
exports.GitHubService = void 0;
var browser_env_config_1 = require("@src/config/browser-env.config");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var GITHUB_API_URL = "https://api.github.com";
var GitHubService = /** @class */ (function () {
    function GitHubService(internalApiService, createHttpClient) {
        this.internalApiService = internalApiService;
        this.githubApiService = createHttpClient({
            baseURL: GITHUB_API_URL,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            }
        });
    }
    GitHubService.prototype.loginWithGithub = function () {
        window.location.href = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_URL;
    };
    GitHubService.prototype.reLoginWithGithub = function () {
        window.location.href = "https://github.com/login/oauth/authorize?client_id=".concat(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_GITHUB_CLIENT_ID, "&redirect_uri=").concat(remote_deploy_config_1.REDIRECT_URL);
    };
    GitHubService.prototype.fetchUserProfile = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.githubApiService.get("/user", {
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
    GitHubService.prototype.fetchRepos = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.githubApiService.get("/user/repos?per_page=150", {
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
    GitHubService.prototype.fetchBranches = function (repo, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.githubApiService.get("/repos/".concat(repo, "/branches"), {
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
    GitHubService.prototype.fetchCommits = function (repo, branch, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.githubApiService.get("/repos/".concat(repo, "/commits?sha=").concat(branch), {
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
    GitHubService.prototype.fetchPackageJson = function (repo, subFolder, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.githubApiService.get("/repos/".concat(repo, "/contents/").concat(subFolder ? "".concat(subFolder, "/") : "", "package.json"), {
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
    GitHubService.prototype.fetchSrcFolders = function (repo, token) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.githubApiService.get("/repos/".concat(repo, "/contents"), {
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
    GitHubService.prototype.fetchAccessToken = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.internalApiService.post("/api/github/authenticate", { code: code })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    return GitHubService;
}());
exports.GitHubService = GitHubService;
