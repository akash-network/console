"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGitlabSrcFolders = exports.useGitlabPackageJson = exports.useGitLabCommits = exports.useGitLabBranches = exports.useGitLabReposByGroup = exports.useGitLabGroups = exports.useGitLabUserProfile = exports.useFetchRefreshToken = exports.useGitLabFetchAccessToken = void 0;
var react_1 = require("react");
var react_query_1 = require("@tanstack/react-query");
var jotai_1 = require("jotai");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var queryKeys_1 = require("./queryKeys");
var OAuthType = "gitlab";
var useGitLabFetchAccessToken = function (onSuccess) {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var _a = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), setToken = _a[1];
    return (0, react_query_1.useMutation)({
        mutationFn: function (code) { return gitlabService.fetchAccessToken(code); },
        onSuccess: function (data) {
            setToken({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                type: OAuthType
            });
            onSuccess();
        }
    });
};
exports.useGitLabFetchAccessToken = useGitLabFetchAccessToken;
var useFetchRefreshToken = function () {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var _a = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), token = _a[0], setToken = _a[1];
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return gitlabService.refreshToken(token === null || token === void 0 ? void 0 : token.refreshToken); },
        onSuccess: function (data) {
            setToken({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                type: OAuthType
            });
        }
    });
};
exports.useFetchRefreshToken = useFetchRefreshToken;
var useGitLabUserProfile = function () {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var mutate = (0, exports.useFetchRefreshToken)().mutate;
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getUserProfileKey(token === null || token === void 0 ? void 0 : token.accessToken),
        queryFn: function () { return gitlabService.fetchUserProfile(token === null || token === void 0 ? void 0 : token.accessToken); },
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
exports.useGitLabUserProfile = useGitLabUserProfile;
var useGitLabGroups = function () {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getGroupsKey(token === null || token === void 0 ? void 0 : token.accessToken),
        queryFn: function () { return gitlabService.fetchGitLabGroups(token === null || token === void 0 ? void 0 : token.accessToken); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType
    });
};
exports.useGitLabGroups = useGitLabGroups;
var useGitLabReposByGroup = function (group) {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getReposByGroupKey(group, token === null || token === void 0 ? void 0 : token.accessToken),
        queryFn: function () { return gitlabService.fetchReposByGroup(group, token === null || token === void 0 ? void 0 : token.accessToken); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!group
    });
};
exports.useGitLabReposByGroup = useGitLabReposByGroup;
var useGitLabBranches = function (repo) {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getBranchesKey(repo, token === null || token === void 0 ? void 0 : token.accessToken),
        queryFn: function () { return gitlabService.fetchBranches(repo, token === null || token === void 0 ? void 0 : token.accessToken); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo
    });
};
exports.useGitLabBranches = useGitLabBranches;
var useGitLabCommits = function (repo, branch) {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getCommitsByBranchKey(repo, branch, token === null || token === void 0 ? void 0 : token.accessToken),
        queryFn: function () { return gitlabService.fetchCommits(repo, branch, token === null || token === void 0 ? void 0 : token.accessToken); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo && !!branch
    });
};
exports.useGitLabCommits = useGitLabCommits;
var useGitlabPackageJson = function (onSettled, repo, subFolder) {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getPackageJsonKey(repo, OAuthType, subFolder),
        queryFn: function () { return gitlabService.fetchPackageJson(repo, subFolder, token === null || token === void 0 ? void 0 : token.accessToken); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo
    });
    (0, react_1.useEffect)(function () {
        var _a;
        if (query.data) {
            if (((_a = query.data) === null || _a === void 0 ? void 0 : _a.content) === undefined) {
                return;
            }
            var content = atob(query.data.content);
            var parsed = JSON.parse(content);
            onSettled(parsed);
        }
    }, [onSettled, query.data]);
    return query;
};
exports.useGitlabPackageJson = useGitlabPackageJson;
var useGitlabSrcFolders = function (onSettled, repo) {
    var gitlabService = (0, ServicesProvider_1.useServices)().gitlabService;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var query = (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getSrcFoldersKey(repo, OAuthType),
        queryFn: function () { return gitlabService.fetchSrcFolders(repo, token === null || token === void 0 ? void 0 : token.accessToken); },
        enabled: !!(token === null || token === void 0 ? void 0 : token.accessToken) && token.type === OAuthType && !!repo
    });
    (0, react_1.useEffect)(function () {
        if (query.data) {
            onSettled(query.data);
        }
    }, [onSettled, query.data]);
    return query;
};
exports.useGitlabSrcFolders = useGitlabSrcFolders;
