"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var useGithubQuery_1 = require("@src/queries/useGithubQuery");
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var useBitBucketQuery_1 = require("../../../queries/useBitBucketQuery");
var RollbackModal_1 = require("./RollbackModal");
var Rollback = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var services = _a.services, control = _a.control;
    var repoUrl = (_d = (_c = (_b = services === null || services === void 0 ? void 0 : services[0]) === null || _b === void 0 ? void 0 : _b.env) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL; })) === null || _d === void 0 ? void 0 : _d.value;
    var branchName = (_g = (_f = (_e = services === null || services === void 0 ? void 0 : services[0]) === null || _e === void 0 ? void 0 : _e.env) === null || _f === void 0 ? void 0 : _f.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME; })) === null || _g === void 0 ? void 0 : _g.value;
    var data = (0, useGithubQuery_1.useCommits)(repoUrl === null || repoUrl === void 0 ? void 0 : repoUrl.replace("https://github.com/", ""), branchName).data;
    var labCommits = (0, useGitlabQuery_1.useGitLabCommits)((_k = (_j = (_h = services === null || services === void 0 ? void 0 : services[0]) === null || _h === void 0 ? void 0 : _h.env) === null || _j === void 0 ? void 0 : _j.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.GITLAB_PROJECT_ID; })) === null || _k === void 0 ? void 0 : _k.value, branchName).data;
    var bitbucketCommits = (0, useBitBucketQuery_1.useBitBucketCommits)((0, remote_deployment_controller_service_1.formatUrlWithoutInitialPath)(repoUrl)).data;
    var commits = (0, react_1.useMemo)(function () {
        var _a;
        if (data === null || data === void 0 ? void 0 : data.length) {
            return formatCommits(data, function (commit) {
                var _a, _b;
                return ({
                    name: commit.commit.message,
                    value: commit.sha,
                    date: new Date(((_b = (_a = commit === null || commit === void 0 ? void 0 : commit.commit) === null || _a === void 0 ? void 0 : _a.author) === null || _b === void 0 ? void 0 : _b.date) || "")
                });
            });
        }
        else if (labCommits === null || labCommits === void 0 ? void 0 : labCommits.length) {
            return formatCommits(labCommits, function (commit) { return ({
                name: commit.title,
                value: commit.id,
                date: new Date(commit.authored_date)
            }); });
        }
        else if ((_a = bitbucketCommits === null || bitbucketCommits === void 0 ? void 0 : bitbucketCommits.values) === null || _a === void 0 ? void 0 : _a.length) {
            return formatCommits(bitbucketCommits.values, function (commit) { return ({
                name: commit.message,
                value: commit.hash,
                date: new Date(commit.date)
            }); });
        }
        return null;
    }, [data, labCommits, bitbucketCommits]);
    function formatCommits(commits, mapFn) {
        return commits.map(mapFn);
    }
    return <RollbackModal_1.default commits={commits} control={control}/>;
};
exports.default = Rollback;
