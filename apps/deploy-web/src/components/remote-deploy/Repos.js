"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var lucide_react_1 = require("lucide-react");
var nanoid_1 = require("nanoid");
var image_1 = require("next/image");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var useRemoteDeployFramework_1 = require("@src/hooks/useRemoteDeployFramework");
var useGithubQuery_1 = require("@src/queries/useGithubQuery");
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var useBitBucketQuery_1 = require("../../queries/useBitBucketQuery");
var BoxTextInput_1 = require("./BoxTextInput");
var Repos = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h;
    var repos = _a.repos, setValue = _a.setValue, isLoading = _a.isLoading, services = _a.services, setDeploymentName = _a.setDeploymentName, profile = _a.profile, _j = _a.type, type = _j === void 0 ? "github" : _j;
    var currentServiceEnv = ((_b = services === null || services === void 0 ? void 0 : services[0]) === null || _b === void 0 ? void 0 : _b.env) || [];
    var currentRepoUrl = (_c = currentServiceEnv === null || currentServiceEnv === void 0 ? void 0 : currentServiceEnv.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL; })) === null || _c === void 0 ? void 0 : _c.value;
    var currentBranchName = (_d = currentServiceEnv === null || currentServiceEnv === void 0 ? void 0 : currentServiceEnv.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME; })) === null || _d === void 0 ? void 0 : _d.value;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var _k = (0, react_1.useState)(""), search = _k[0], setSearch = _k[1];
    var _l = (0, react_1.useState)(repos), filteredRepos = _l[0], setFilteredRepos = _l[1];
    var _m = (0, react_1.useState)(""), currentAccount = _m[0], setCurrentAccount = _m[1];
    var _o = (0, react_1.useState)(null), directory = _o[0], setDirectory = _o[1];
    var _p = (0, react_1.useState)(false), open = _p[0], setOpen = _p[1];
    var _q = (0, react_1.useState)([]), accounts = _q[0], setAccounts = _q[1];
    var repo = repos === null || repos === void 0 ? void 0 : repos.find(function (r) { return r.html_url === currentRepoUrl; });
    var currentFolder = currentServiceEnv === null || currentServiceEnv === void 0 ? void 0 : currentServiceEnv.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.FRONTEND_FOLDER; });
    var _r = (0, useRemoteDeployFramework_1.default)({
        currentRepoUrl: currentRepoUrl,
        currentBranchName: currentBranchName,
        currentGitlabProjectId: (_e = currentServiceEnv === null || currentServiceEnv === void 0 ? void 0 : currentServiceEnv.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.GITLAB_PROJECT_ID; })) === null || _e === void 0 ? void 0 : _e.value,
        subFolder: currentFolder === null || currentFolder === void 0 ? void 0 : currentFolder.value,
        setCpus: function (cpus) { return setValue("services.0.profile.cpu", +cpus > 2 ? +cpus : 2); }
    }), currentFramework = _r.currentFramework, frameworkLoading = _r.isLoading;
    var _s = (0, useGithubQuery_1.useSrcFolders)(setFolders, (0, remote_deployment_controller_service_1.formatUrlWithoutInitialPath)(currentRepoUrl)), isGettingDirectory = _s.isLoading, isGithubLoading = _s.isFetching;
    var _t = (0, useBitBucketQuery_1.useBitSrcFolders)(setFolders, (0, remote_deployment_controller_service_1.formatUrlWithoutInitialPath)(currentRepoUrl), currentBranchName), isGettingDirectoryBit = _t.isLoading, isBitLoading = _t.isFetching;
    var _u = (0, useGitlabQuery_1.useGitlabSrcFolders)(setFolders, (_f = currentServiceEnv === null || currentServiceEnv === void 0 ? void 0 : currentServiceEnv.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.GITLAB_PROJECT_ID; })) === null || _f === void 0 ? void 0 : _f.value), isGettingDirectoryGitlab = _u.isLoading, isGitlabLoading = _u.isFetching;
    var isLoadingDirectories = isGithubLoading || isGitlabLoading || isBitLoading || isGettingDirectory || isGettingDirectoryBit || isGettingDirectoryGitlab;
    var envVarUpdater = (0, react_1.useMemo)(function () { return new remote_deployment_controller_service_1.EnvVarUpdater(services); }, [services]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (type === "github") {
            var differentOwnersArray = repos === null || repos === void 0 ? void 0 : repos.map(function (repo) { var _a; return ((_a = repo === null || repo === void 0 ? void 0 : repo.owner) === null || _a === void 0 ? void 0 : _a.login) || ""; });
            var uniqueOwners = Array.from(new Set(differentOwnersArray));
            setAccounts(uniqueOwners);
            setCurrentAccount(((_b = (_a = repos === null || repos === void 0 ? void 0 : repos.find(function (repo) { var _a; return currentRepoUrl === null || currentRepoUrl === void 0 ? void 0 : currentRepoUrl.includes((_a = repo === null || repo === void 0 ? void 0 : repo.html_url) === null || _a === void 0 ? void 0 : _a.replace("https://github.com/", "")); })) === null || _a === void 0 ? void 0 : _a.owner) === null || _b === void 0 ? void 0 : _b.login) ||
                (uniqueOwners === null || uniqueOwners === void 0 ? void 0 : uniqueOwners.find(function (account) { return (profile === null || profile === void 0 ? void 0 : profile.login) === account; })) ||
                (uniqueOwners === null || uniqueOwners === void 0 ? void 0 : uniqueOwners[0]));
        }
        setFilteredRepos(repos);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, type, profile]);
    function setFolders(data) {
        if ((data === null || data === void 0 ? void 0 : data.length) > 0) {
            setDirectory(data);
        }
        else {
            setDirectory(null);
        }
    }
    return (<div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Repository</h1>
        <p className="text-muted-foreground">Select a Repo to be deployed</p>
      </div>

      <components_1.Dialog open={open} onOpenChange={setOpen}>
        <components_1.DialogTrigger asChild>
          <components_1.Button variant="outline" className="flex justify-between bg-popover">
            <div className="flex items-center gap-2">
              {!frameworkLoading && currentFramework && (currentFramework === null || currentFramework === void 0 ? void 0 : currentFramework.image) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentFramework.image} alt={currentFramework.title} className="h-6 w-6"/>) : (<lucide_react_1.Globe2 size={20}/>)}
              <p>{(repo === null || repo === void 0 ? void 0 : repo.name) || "Select Repository"}</p>
            </div>
            <iconoir_react_1.Folder />
          </components_1.Button>
        </components_1.DialogTrigger>
        <components_1.DialogContent hideCloseButton className="max-h-[80dvh] gap-0 overflow-y-auto p-0 sm:max-w-[525px]">
          <components_1.DialogHeader className="sticky top-0 z-[5] flex flex-col gap-4 bg-popover px-5 pb-4 pt-6">
            <components_1.DialogTitle>Search Repository</components_1.DialogTitle>
            <div className="flex gap-3">
              {type === "github" && (<components_1.Select onValueChange={setCurrentAccount} defaultValue={currentAccount} value={currentAccount}>
                  <components_1.SelectTrigger className="w-full flex-1">
                    <components_1.SelectValue placeholder="Select Account"/>
                  </components_1.SelectTrigger>
                  <components_1.SelectContent>
                    {accounts === null || accounts === void 0 ? void 0 : accounts.map(function (account, index) {
                var _a, _b, _c, _d;
                return (<components_1.SelectItem key={index} value={account}>
                        <div className="flex items-center gap-2">
                          {((_b = (_a = repos === null || repos === void 0 ? void 0 : repos.find(function (repo) { var _a; return ((_a = repo === null || repo === void 0 ? void 0 : repo.owner) === null || _a === void 0 ? void 0 : _a.login) === account; })) === null || _a === void 0 ? void 0 : _a.owner) === null || _b === void 0 ? void 0 : _b.avatar_url) ? (<image_1.default width={24} height={24} src={((_d = (_c = repos === null || repos === void 0 ? void 0 : repos.find(function (repo) { var _a; return ((_a = repo === null || repo === void 0 ? void 0 : repo.owner) === null || _a === void 0 ? void 0 : _a.login) === account; })) === null || _c === void 0 ? void 0 : _c.owner) === null || _d === void 0 ? void 0 : _d.avatar_url) || ""} alt={account} className="h-6 w-6 rounded-full"/>) : (<iconoir_react_1.GithubCircle />)}
                          {account}
                        </div>
                      </components_1.SelectItem>);
            })}
                  </components_1.SelectContent>
                </components_1.Select>)}
              <components_1.Input placeholder="Search..." value={search} className="w-full flex-1" onChange={function (e) {
            setSearch(e.target.value);
            setFilteredRepos(repos === null || repos === void 0 ? void 0 : repos.filter(function (repo) { return repo.name.toLowerCase().includes(e.target.value.toLowerCase()); }));
        }}/>
            </div>
          </components_1.DialogHeader>
          <div className="flex flex-col">
            {(_g = filteredRepos === null || filteredRepos === void 0 ? void 0 : filteredRepos.filter(function (repo) { var _a; return ((_a = repo === null || repo === void 0 ? void 0 : repo.owner) === null || _a === void 0 ? void 0 : _a.login) === currentAccount || type !== "github"; })) === null || _g === void 0 ? void 0 : _g.map(function (repo) {
            var _a;
            return (<div key={repo.html_url} className="flex flex-col gap-3 border-b px-5 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {currentFramework && !frameworkLoading && currentRepoUrl === repo.html_url ? ((currentFramework === null || currentFramework === void 0 ? void 0 : currentFramework.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentFramework.image} alt={currentFramework.title} className="h-6 w-6"/>) : (<lucide_react_1.Globe2 size={22}/>)) : (<iconoir_react_1.GithubCircle />)}
                        <p>{repo.name}</p>
                        {repo.private && <iconoir_react_1.Lock className="ml-1 text-xs"/>}
                      </div>
                    </div>
                    {currentRepoUrl === (repo === null || repo === void 0 ? void 0 : repo.html_url) ? (<components_1.Button variant="default" size="sm" onClick={function () {
                        setOpen(false);
                    }}>
                        Done
                      </components_1.Button>) : (<components_1.Button variant="default" size="sm" disabled={currentRepoUrl === repo.html_url} onClick={function () {
                        var _a;
                        setDirectory(null);
                        var repoUrl = { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL, value: repo.html_url, isSecret: false };
                        var branchName = { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME, value: repo.default_branch, isSecret: false };
                        if (type === "github") {
                            setValue("services.0.env", [
                                repoUrl,
                                branchName,
                                { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.GITHUB_ACCESS_TOKEN, value: (token === null || token === void 0 ? void 0 : token.accessToken) || "", isSecret: false }
                            ]);
                        }
                        if (type === "bitbucket") {
                            setValue("services.0.env", [
                                repoUrl,
                                branchName,
                                { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.BITBUCKET_ACCESS_TOKEN, value: (token === null || token === void 0 ? void 0 : token.accessToken) || "", isSecret: false },
                                { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.BITBUCKET_USER, value: (repo === null || repo === void 0 ? void 0 : repo.userName) || "", isSecret: false }
                            ]);
                        }
                        if (type === "gitlab") {
                            setValue("services.0.env", [
                                repoUrl,
                                branchName,
                                { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.GITLAB_ACCESS_TOKEN, value: (token === null || token === void 0 ? void 0 : token.accessToken) || "", isSecret: false },
                                {
                                    id: (0, nanoid_1.nanoid)(),
                                    key: remote_deploy_config_1.protectedEnvironmentVariables.GITLAB_PROJECT_ID,
                                    value: (_a = repo === null || repo === void 0 ? void 0 : repo.id) === null || _a === void 0 ? void 0 : _a.toString(),
                                    isSecret: false
                                }
                            ]);
                        }
                        setDeploymentName(repo.name);
                    }}>
                        Select
                      </components_1.Button>)}
                  </div>
                  {isLoadingDirectories && currentRepoUrl === repo.html_url && (<div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Fetching Directory</p>
                      <components_1.Spinner size="small"/>
                    </div>)}
                  {currentRepoUrl === repo.html_url &&
                    (directory && ((_a = directory === null || directory === void 0 ? void 0 : directory.filter(function (item) { return item.type === "dir" || item.type === "commit_directory" || item.type === "tree"; })) === null || _a === void 0 ? void 0 : _a.length) > 0 ? (<div className="flex flex-col">
                        <div className="flex items-center justify-between pb-3">
                          <p className="text-sm text-muted-foreground">Select Directory</p>
                        </div>

                        <components_1.RadioGroup className="gap-0" onValueChange={function (value) {
                            if (value === remote_deploy_config_1.ROOT_FOLDER_NAME) {
                                setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater === null || envVarUpdater === void 0 ? void 0 : envVarUpdater.deleteEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.FRONTEND_FOLDER));
                            }
                            else {
                                setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater === null || envVarUpdater === void 0 ? void 0 : envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.FRONTEND_FOLDER, value, false));
                            }
                        }} value={(currentFolder === null || currentFolder === void 0 ? void 0 : currentFolder.value) || remote_deploy_config_1.ROOT_FOLDER_NAME}>
                          <div className="flex items-center justify-between border-card-foreground py-1">
                            <components_1.Label htmlFor={remote_deploy_config_1.ROOT_FOLDER_NAME} className="flex items-center gap-2">
                              <iconoir_react_1.Folder />
                              ./
                            </components_1.Label>
                            <components_1.RadioGroupItem value={remote_deploy_config_1.ROOT_FOLDER_NAME} id={remote_deploy_config_1.ROOT_FOLDER_NAME}/>
                          </div>
                          {directory === null || directory === void 0 ? void 0 : directory.filter(function (item) { return item.type === "dir" || item.type === "commit_directory" || item.type === "tree"; }).map(function (item) { return (<div className="flex items-center justify-between border-l border-card-foreground py-1 pl-4" key={item.path}>
                                <components_1.Label htmlFor={item.path} className="flex items-center gap-2">
                                  <iconoir_react_1.Folder />
                                  {item.path}
                                </components_1.Label>
                                <components_1.RadioGroupItem value={item.path} id={item.path}/>
                              </div>); })}
                        </components_1.RadioGroup>
                      </div>) : (<BoxTextInput_1.default onChange={function (e) {
                            return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater === null || envVarUpdater === void 0 ? void 0 : envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.FRONTEND_FOLDER, e.target.value, false));
                        }} label="Frontend Folder" description="By default we use ./, Change the version if needed" placeholder="eg. app"/>))}
                </div>);
        })}
            {isLoading && (<div className="flex items-center justify-center p-4">
                <components_1.Spinner size="medium"/>
              </div>)}
            {((_h = filteredRepos === null || filteredRepos === void 0 ? void 0 : filteredRepos.filter(function (repo) { var _a; return ((_a = repo === null || repo === void 0 ? void 0 : repo.owner) === null || _a === void 0 ? void 0 : _a.login) === currentAccount || type !== "github"; })) === null || _h === void 0 ? void 0 : _h.length) === 0 && (<div className="flex items-center justify-center p-4">No Repository Found</div>)}
          </div>
        </components_1.DialogContent>
      </components_1.Dialog>
    </div>);
};
exports.default = Repos;
