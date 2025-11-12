"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var useBitBucketQuery_1 = require("../../../queries/useBitBucketQuery");
var Repos_1 = require("../Repos");
var BitBucketBranches_1 = require("./BitBucketBranches");
var Workspaces_1 = require("./Workspaces");
var BitBucketManager = function (_a) {
    var _b;
    var loading = _a.loading, setValue = _a.setValue, services = _a.services, control = _a.control, setDeploymentName = _a.setDeploymentName, deploymentName = _a.deploymentName, profile = _a.profile;
    var _c = (0, react_1.useState)(""), workSpace = _c[0], setWorkSpace = _c[1];
    var _d = (0, useBitBucketQuery_1.useBitReposByWorkspace)(workSpace), repos = _d.data, isLoading = _d.isLoading;
    return (<>
      <Workspaces_1.default isLoading={loading} workSpaces={workSpace} setWorkSpaces={setWorkSpace}/>
      <Repos_1.default isLoading={isLoading} repos={(_b = repos === null || repos === void 0 ? void 0 : repos.values.map(function (repo) {
            var _a, _b, _c;
            return ({
                name: repo.name,
                default_branch: (_a = repo === null || repo === void 0 ? void 0 : repo.mainbranch) === null || _a === void 0 ? void 0 : _a.name,
                html_url: (_c = (_b = repo === null || repo === void 0 ? void 0 : repo.links) === null || _b === void 0 ? void 0 : _b.html) === null || _c === void 0 ? void 0 : _c.href,
                userName: profile === null || profile === void 0 ? void 0 : profile.username,
                private: repo === null || repo === void 0 ? void 0 : repo.is_private
            });
        })) !== null && _b !== void 0 ? _b : []} type="bitbucket" setValue={setValue} setDeploymentName={setDeploymentName} deploymentName={deploymentName} services={services}/>
      <BitBucketBranches_1.default services={services} control={control}/>
    </>);
};
exports.default = BitBucketManager;
