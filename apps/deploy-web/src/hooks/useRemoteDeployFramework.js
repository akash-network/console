"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var useBitBucketQuery_1 = require("@src/queries/useBitBucketQuery");
var useGithubQuery_1 = require("@src/queries/useGithubQuery");
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var useRemoteDeployFramework = function (_a) {
    var _b;
    var currentRepoUrl = _a.currentRepoUrl, currentBranchName = _a.currentBranchName, currentGitlabProjectId = _a.currentGitlabProjectId, subFolder = _a.subFolder, setCpus = _a.setCpus;
    var _c = (0, react_1.useState)(null), packageJson = _c[0], setPackageJson = _c[1];
    var isLoading = (0, useGithubQuery_1.usePackageJson)(setValueHandler, (0, remote_deployment_controller_service_1.formatUrlWithoutInitialPath)(currentRepoUrl), subFolder).isLoading;
    var _d = (0, useGitlabQuery_1.useGitlabPackageJson)(setValueHandler, currentGitlabProjectId, subFolder), gitlabLoading = _d.isLoading, isFetching = _d.isFetching;
    var bitbucketLoading = (0, useBitBucketQuery_1.useBitPackageJson)(setValueHandler, (0, remote_deployment_controller_service_1.formatUrlWithoutInitialPath)(currentRepoUrl), currentBranchName, subFolder).isLoading;
    function setValueHandler(data) {
        var _a, _b, _c;
        if (data === null || data === void 0 ? void 0 : data.dependencies) {
            setPackageJson(data);
            var cpus = (_c = (((_b = Object.keys((_a = data === null || data === void 0 ? void 0 : data.dependencies) !== null && _a !== void 0 ? _a : {})) === null || _b === void 0 ? void 0 : _b.length) / 10 / 2)) === null || _c === void 0 ? void 0 : _c.toFixed(1);
            setCpus(+cpus > 2 ? +cpus : 2);
        }
        else {
            setPackageJson(null);
        }
    }
    return {
        currentFramework: (_b = remote_deploy_config_1.supportedFrameworks.find(function (f) { var _a, _b; return (_b = (_a = packageJson === null || packageJson === void 0 ? void 0 : packageJson.scripts) === null || _a === void 0 ? void 0 : _a.dev) === null || _b === void 0 ? void 0 : _b.includes(f.value); })) !== null && _b !== void 0 ? _b : {
            title: "Other",
            value: "other"
        },
        isLoading: isLoading || gitlabLoading || bitbucketLoading || isFetching
    };
};
exports.default = useRemoteDeployFramework;
