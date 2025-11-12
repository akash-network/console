"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var useGithubQuery_1 = require("@src/queries/useGithubQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var SelectBranches_1 = require("../SelectBranches");
var GithubBranches = function (_a) {
    var _b, _c, _d;
    var services = _a.services, control = _a.control;
    var selected = (0, remote_deployment_controller_service_1.formatUrlWithoutInitialPath)((_d = (_c = (_b = services === null || services === void 0 ? void 0 : services[0]) === null || _b === void 0 ? void 0 : _b.env) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL; })) === null || _d === void 0 ? void 0 : _d.value);
    var _e = (0, useGithubQuery_1.useBranches)(selected), branches = _e.data, branchesLoading = _e.isLoading;
    return <SelectBranches_1.default control={control} loading={branchesLoading} branches={branches} selected={selected}/>;
};
exports.default = GithubBranches;
