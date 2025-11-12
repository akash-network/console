"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var Repos_1 = require("../Repos");
var GitlabBranches_1 = require("./GitlabBranches");
var Groups_1 = require("./Groups");
var GitlabManager = function (_a) {
    var _b;
    var loading = _a.loading, setValue = _a.setValue, services = _a.services, control = _a.control, setDeploymentName = _a.setDeploymentName, deploymentName = _a.deploymentName;
    var _c = (0, react_1.useState)(""), group = _c[0], setGroup = _c[1];
    var _d = (0, useGitlabQuery_1.useGitLabReposByGroup)(group), repos = _d.data, isLoading = _d.isLoading;
    return (<>
      <Groups_1.default isLoading={loading} setGroup={setGroup}/>
      <Repos_1.default services={services} isLoading={isLoading} repos={(_b = repos === null || repos === void 0 ? void 0 : repos.map(function (repo) {
            var _a;
            return ({
                name: repo.name,
                id: (_a = repo.id) === null || _a === void 0 ? void 0 : _a.toString(),
                default_branch: repo === null || repo === void 0 ? void 0 : repo.default_branch,
                html_url: repo === null || repo === void 0 ? void 0 : repo.web_url,
                userName: "gitlab",
                private: (repo === null || repo === void 0 ? void 0 : repo.visibility) === "private"
            });
        })) !== null && _b !== void 0 ? _b : []} setValue={setValue} setDeploymentName={setDeploymentName} deploymentName={deploymentName} type="gitlab"/>
      <GitlabBranches_1.default services={services} control={control} repos={repos}/>
    </>);
};
exports.default = GitlabManager;
