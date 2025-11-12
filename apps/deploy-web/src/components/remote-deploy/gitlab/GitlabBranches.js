"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var SelectBranches_1 = require("../SelectBranches");
var GitlabBranches = function (_a) {
    var _b, _c, _d, _e, _f;
    var repos = _a.repos, services = _a.services, control = _a.control;
    var selected = repos && (repos === null || repos === void 0 ? void 0 : repos.length) > 0
        ? (_c = (_b = repos === null || repos === void 0 ? void 0 : repos.find(function (e) { var _a, _b, _c; return e.web_url === ((_c = (_b = (_a = services === null || services === void 0 ? void 0 : services[0]) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.find(function (e) { return e.key === "REPO_URL"; })) === null || _c === void 0 ? void 0 : _c.value); })) === null || _b === void 0 ? void 0 : _b.id) === null || _c === void 0 ? void 0 : _c.toString()
        : (_f = (_e = (_d = services === null || services === void 0 ? void 0 : services[0]) === null || _d === void 0 ? void 0 : _d.env) === null || _e === void 0 ? void 0 : _e.find(function (e) { return e.key === "GITLAB_PROJECT_ID"; })) === null || _f === void 0 ? void 0 : _f.value;
    var _g = (0, useGitlabQuery_1.useGitLabBranches)(selected), branches = _g.data, branchesLoading = _g.isLoading;
    return <SelectBranches_1.default control={control} selected={selected} loading={branchesLoading} branches={branches}/>;
};
exports.default = GitlabBranches;
