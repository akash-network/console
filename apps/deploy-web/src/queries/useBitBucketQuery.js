"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.useBitSrcFolders = exports.useBitPackageJson = exports.useBitBranches = exports.useBitReposByWorkspace = exports.useWorkspaces = exports.useBitBucketCommits = exports.useBitUserProfile = exports.useBitFetchAccessToken = void 0;
var react_1 = require("react");
var react_query_1 = require("@tanstack/react-query");
var jotai_1 = require("jotai");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var queryKeys_1 = require("./queryKeys");
var OAuthType = "bitbucket";
var useFetchRefreshBitToken = function () {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var _a = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), token = _a[0], setToken = _a[1];
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchRefreshToken(token === null || token === void 0 ? void 0 : token.refreshToken)];
        }); }); },
        onSuccess: function (data) {
            setToken(__assign(__assign({}, data), { type: "bitbucket" }));
        }
    });
};
var useBitFetchAccessToken = function (onSuccess) {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var _a = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), setToken = _a[1];
    return (0, react_query_1.useMutation)({
        mutationFn: function (code) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchAccessToken(code)];
        }); }); },
        onSuccess: function (data) {
            setToken(__assign(__assign({}, data), { type: OAuthType }));
            onSuccess();
        }
    });
};
exports.useBitFetchAccessToken = useBitFetchAccessToken;
var useBitUserProfile = function () {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var mutate = useFetchRefreshBitToken().mutate;
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getUserProfileKey(token.accessToken),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchUserProfile(token.accessToken)];
        }); }); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType
    });
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (((_b = (_a = query.error) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b.status) === 401) {
            mutate();
        }
    }, [query.error, mutate]);
    return query;
};
exports.useBitUserProfile = useBitUserProfile;
var useBitBucketCommits = function (repo) {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getCommitsKey(repo, token.accessToken),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchCommits(repo, token.accessToken)];
        }); }); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo
    });
};
exports.useBitBucketCommits = useBitBucketCommits;
var useWorkspaces = function () {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getWorkspacesKey(token.accessToken),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchWorkspaces(token.accessToken)];
        }); }); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType
    });
};
exports.useWorkspaces = useWorkspaces;
var useBitReposByWorkspace = function (workspace) {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getReposByWorkspaceKey(workspace, token.accessToken),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchReposByWorkspace(workspace, token.accessToken)];
        }); }); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!workspace
    });
};
exports.useBitReposByWorkspace = useBitReposByWorkspace;
var useBitBranches = function (repo) {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getBranchesKey(repo, token.accessToken),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchBranches(repo, token.accessToken)];
        }); }); },
        enabled: !!repo && !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType
    });
};
exports.useBitBranches = useBitBranches;
var useBitPackageJson = function (onSettled, repo, branch, subFolder) {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getPackageJsonKey(repo, branch, subFolder),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchPackageJson(repo, branch, subFolder, token.accessToken)];
        }); }); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo && !!branch
    });
    (0, react_1.useEffect)(function () {
        if (query.data) {
            onSettled(query.data);
        }
    }, [onSettled, query.data]);
    return query;
};
exports.useBitPackageJson = useBitPackageJson;
var useBitSrcFolders = function (onSettled, repo, branch) {
    var bitbucketService = (0, ServicesProvider_1.useServices)().bitbucketService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getSrcFoldersKey(repo, branch),
        queryFn: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, bitbucketService.fetchSrcFolders(repo, branch, token.accessToken)];
        }); }); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo && !!branch
    });
    (0, react_1.useEffect)(function () {
        var _a;
        if (query.data) {
            onSettled((_a = query.data) === null || _a === void 0 ? void 0 : _a.values);
        }
    }, [onSettled, query.data]);
    return query;
};
exports.useBitSrcFolders = useBitSrcFolders;
