"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var navigation_1 = require("next/navigation");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useWhen_1 = require("@src/hooks/useWhen");
var useGithubQuery_1 = require("@src/queries/useGithubQuery");
var useGitlabQuery_1 = require("@src/queries/useGitlabQuery");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var route_steps_type_1 = require("@src/types/route-steps.type");
var urlUtils_1 = require("@src/utils/urlUtils");
var useBitBucketQuery_1 = require("../../queries/useBitBucketQuery");
var BitBucketManager_1 = require("./bitbucket/BitBucketManager");
var RemoteBuildInstallConfig_1 = require("./deployment-configurations/RemoteBuildInstallConfig");
var RemoteDeployEnvDropdown_1 = require("./deployment-configurations/RemoteDeployEnvDropdown");
var GithubManager_1 = require("./github/GithubManager");
var GitlabManager_1 = require("./gitlab/GitlabManager");
var AccountDropdown_1 = require("./AccountDropdown");
var BoxTextInput_1 = require("./BoxTextInput");
var RemoteRepositoryDeployManager = function (_a) {
    var _b, _c;
    var setValue = _a.setValue, services = _a.services, control = _a.control, deploymentName = _a.deploymentName, setDeploymentName = _a.setDeploymentName, setIsRepoInputValid = _a.setIsRepoInputValid;
    var _d = (0, ServicesProvider_1.useServices)(), githubService = _d.githubService, bitbucketService = _d.bitbucketService, gitlabService = _d.gitlabService;
    var _e = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), token = _e[0], setToken = _e[1];
    var _f = (0, react_1.useState)("git"), selectedTab = _f[0], setSelectedTab = _f[1];
    var router = (0, navigation_1.useRouter)();
    var _g = (0, react_1.useState)(false), hydrated = _g[0], setHydrated = _g[1];
    var isRepoAndBranchPresent = function (env) {
        return env.some(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL; }) && env.some(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME; });
    };
    var isValid = isRepoAndBranchPresent(((_b = services === null || services === void 0 ? void 0 : services[0]) === null || _b === void 0 ? void 0 : _b.env) || []);
    var isRepoUrlDefault = function (env) { return env === null || env === void 0 ? void 0 : env.some(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL && e.value === remote_deploy_config_1.DEFAULT_ENV_IN_YML; }); };
    var shouldResetValue = isRepoUrlDefault(((_c = services === null || services === void 0 ? void 0 : services[0]) === null || _c === void 0 ? void 0 : _c.env) || []);
    var envVarUpdater = (0, react_1.useMemo)(function () { return new remote_deployment_controller_service_1.EnvVarUpdater(services); }, [services]);
    var _h = (0, useGithubQuery_1.useUserProfile)(), userProfile = _h.data, fetchingProfile = _h.isLoading;
    var _j = (0, useGithubQuery_1.useFetchAccessToken)(navigateToNewDeployment), fetchAccessToken = _j.mutate, fetchingToken = _j.isPending;
    var _k = (0, useBitBucketQuery_1.useBitUserProfile)(), userProfileBit = _k.data, fetchingProfileBit = _k.isLoading;
    var _l = (0, useBitBucketQuery_1.useBitFetchAccessToken)(navigateToNewDeployment), fetchAccessTokenBit = _l.mutate, fetchingTokenBit = _l.isPending;
    var _m = (0, useGitlabQuery_1.useGitLabUserProfile)(), userProfileGitLab = _m.data, fetchingProfileGitLab = _m.isLoading;
    var _o = (0, useGitlabQuery_1.useGitLabFetchAccessToken)(navigateToNewDeployment), fetchAccessTokenGitLab = _o.mutate, fetchingTokenGitLab = _o.isPending;
    (0, useWhen_1.useWhen)(isValid, function () {
        setIsRepoInputValid === null || setIsRepoInputValid === void 0 ? void 0 : setIsRepoInputValid(true);
    });
    (0, useWhen_1.useWhen)(!isValid, function () {
        setIsRepoInputValid === null || setIsRepoInputValid === void 0 ? void 0 : setIsRepoInputValid(false);
    });
    (0, useWhen_1.useWhen)(shouldResetValue, function () {
        setValue(remote_deploy_config_1.CURRENT_SERVICE, []);
    });
    (0, react_1.useEffect)(function () {
        setHydrated(true);
    }, []);
    (0, react_1.useEffect)(function () {
        var url = new URL(window.location.href);
        var code = url.searchParams.get("code");
        if (code && !(token === null || token === void 0 ? void 0 : token.accessToken) && hydrated) {
            if ((token === null || token === void 0 ? void 0 : token.type) === "github")
                fetchAccessToken(code);
            if ((token === null || token === void 0 ? void 0 : token.type) === "bitbucket")
                fetchAccessTokenBit(code);
            if ((token === null || token === void 0 ? void 0 : token.type) === "gitlab")
                fetchAccessTokenGitLab(code);
        }
    }, [hydrated]);
    function navigateToNewDeployment() {
        router.replace(urlUtils_1.UrlService.newDeployment({
            step: route_steps_type_1.RouteStep.editDeployment,
            gitProvider: "github",
            templateId: remote_deploy_config_1.CI_CD_TEMPLATE_ID
        }));
    }
    return (<>
      <div className="mt-6 flex flex-col rounded border bg-card px-4 py-6 text-card-foreground md:px-6">
        <div className="flex items-center justify-between gap-6">
          <h2 className="font-semibold">Import Repository</h2>

          {(token === null || token === void 0 ? void 0 : token.accessToken) && (<div className="md:hidden">
              <AccountDropdown_1.default userProfile={userProfile} userProfileBit={userProfileBit} userProfileGitLab={userProfileGitLab}/>
            </div>)}
        </div>

        {<components_1.Tabs onValueChange={function (value) {
                setSelectedTab(value);
                setValue(remote_deploy_config_1.CURRENT_SERVICE, []);
            }} defaultValue="git" className="mt-6">
            <div className="mb-6 flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
              <components_1.TabsList className="md:gap-auto flex h-auto w-full flex-col items-center gap-1 p-2 md:w-auto md:flex-row md:gap-0 md:px-1 md:py-1">
                <components_1.TabsTrigger value="git" className="w-full py-2.5 md:w-auto md:py-1.5">
                  Git Provider
                </components_1.TabsTrigger>
                <components_1.TabsTrigger value="public" className="w-full py-2.5 md:w-auto md:py-1.5">
                  Third-Party Git Repository
                </components_1.TabsTrigger>
              </components_1.TabsList>
              {(token === null || token === void 0 ? void 0 : token.accessToken) && (<div className="hidden md:block">
                  <AccountDropdown_1.default userProfile={userProfile} userProfileBit={userProfileBit} userProfileGitLab={userProfileGitLab}/>
                </div>)}
            </div>
            <components_1.TabsContent value="git">
              {fetchingToken || fetchingProfile || fetchingTokenBit || fetchingProfileBit || fetchingTokenGitLab || fetchingProfileGitLab ? (<div className="flex flex-col items-center justify-center gap-2 rounded border px-5 py-10">
                  <components_1.Spinner size="large"/>
                  <p className="text-muted-foreground">Loading...</p>
                </div>) : (!(token === null || token === void 0 ? void 0 : token.accessToken) && (<div className="flex flex-col justify-center gap-6 rounded-sm border px-4 py-8 md:items-center">
                    <div className="flex flex-col items-center justify-center">
                      <h1 className="text-lg font-bold text-primary">Connect Account</h1>
                      <p className="text-center text-sm text-muted-foreground">Connect a git provider to access your repositories.</p>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row">
                      <components_1.Button onClick={function () {
                    setToken({ accessToken: null, refreshToken: null, type: "bitbucket", alreadyLoggedIn: token === null || token === void 0 ? void 0 : token.alreadyLoggedIn });
                    bitbucketService.loginWithBitBucket();
                }} variant="outline">
                        <iconoir_react_1.Bitbucket className="mr-2"/>
                        Bitbucket
                      </components_1.Button>
                      <components_1.Button onClick={function () {
                    setToken({ accessToken: null, refreshToken: null, type: "gitlab", alreadyLoggedIn: token === null || token === void 0 ? void 0 : token.alreadyLoggedIn });
                    gitlabService.loginWithGitLab();
                }} variant="outline">
                        <iconoir_react_1.GitlabFull className="mr-2"/>
                        GitLab
                      </components_1.Button>
                      <components_1.Button onClick={function () {
                    var _a;
                    setToken({ accessToken: null, refreshToken: null, type: "github", alreadyLoggedIn: token === null || token === void 0 ? void 0 : token.alreadyLoggedIn });
                    if ((_a = token === null || token === void 0 ? void 0 : token.alreadyLoggedIn) === null || _a === void 0 ? void 0 : _a.includes("github")) {
                        githubService.reLoginWithGithub();
                    }
                    else {
                        githubService.loginWithGithub();
                    }
                }} variant="outline">
                        <iconoir_react_1.Github className="mr-2"/>
                        Github
                      </components_1.Button>
                    </div>
                  </div>))}
            </components_1.TabsContent>

            <components_1.TabsContent value="public" className="grid gap-6 lg:grid-cols-2">
              <BoxTextInput_1.default label="Repository URL" description="The link of the public repo to be deployed" placeholder="eg. https://github.com/username/repo.git" onChange={function (e) {
                return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL, e.target.value, false));
            }}/>
              <BoxTextInput_1.default label="Branch Name" description="The git branch branch which is to be deployed" placeholder="eg. main" onChange={function (e) {
                return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME, e.target.value, false));
            }}/>
            </components_1.TabsContent>
          </components_1.Tabs>}

        {selectedTab === "git" && (token === null || token === void 0 ? void 0 : token.accessToken) && (<div className="grid gap-6 md:grid-cols-2">
            {(token === null || token === void 0 ? void 0 : token.type) === "github" ? (<>
                <GithubManager_1.default setValue={setValue} services={services} control={control} setDeploymentName={setDeploymentName} deploymentName={deploymentName} profile={userProfile}/>
              </>) : (token === null || token === void 0 ? void 0 : token.type) === "bitbucket" ? (<BitBucketManager_1.default loading={fetchingProfileBit} setValue={setValue} services={services} control={control} setDeploymentName={setDeploymentName} deploymentName={deploymentName} profile={userProfileBit}/>) : (<GitlabManager_1.default loading={fetchingProfileGitLab} setValue={setValue} services={services} control={control} setDeploymentName={setDeploymentName} deploymentName={deploymentName}/>)}
          </div>)}
      </div>
      <RemoteBuildInstallConfig_1.default services={services} setValue={setValue}/>
      <RemoteDeployEnvDropdown_1.default services={services} control={control}/>
    </>);
};
exports.default = RemoteRepositoryDeployManager;
