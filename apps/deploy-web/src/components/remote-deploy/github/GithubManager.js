"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var useGithubQuery_1 = require("@src/queries/useGithubQuery");
var Repos_1 = require("../Repos");
var GithubBranches_1 = require("./GithubBranches");
var GithubManager = function (_a) {
    var _b;
    var control = _a.control, setValue = _a.setValue, services = _a.services, setDeploymentName = _a.setDeploymentName, deploymentName = _a.deploymentName, profile = _a.profile;
    var _c = (0, useGithubQuery_1.useRepos)(), repos = _c.data, isLoading = _c.isLoading;
    return (<>
      <Repos_1.default repos={(_b = repos === null || repos === void 0 ? void 0 : repos.filter(function (repo) { var _a, _b; return ((_a = repo.owner) === null || _a === void 0 ? void 0 : _a.login) === (profile === null || profile === void 0 ? void 0 : profile.login) || ((_b = repo === null || repo === void 0 ? void 0 : repo.owner) === null || _b === void 0 ? void 0 : _b.type) === "Organization"; })) === null || _b === void 0 ? void 0 : _b.map(function (repo) {
            var _a;
            return ({
                name: repo.name,
                default_branch: repo === null || repo === void 0 ? void 0 : repo.default_branch,
                html_url: repo === null || repo === void 0 ? void 0 : repo.html_url,
                private: repo === null || repo === void 0 ? void 0 : repo.private,
                id: (_a = repo.id) === null || _a === void 0 ? void 0 : _a.toString(),
                owner: repo === null || repo === void 0 ? void 0 : repo.owner
            });
        })} setValue={setValue} isLoading={isLoading} services={services} setDeploymentName={setDeploymentName} deploymentName={deploymentName} profile={profile}/>
      <GithubBranches_1.default services={services} control={control}/>
    </>);
};
exports.default = GithubManager;
