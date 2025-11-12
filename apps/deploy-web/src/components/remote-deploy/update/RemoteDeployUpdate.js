"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var jotai_1 = require("jotai");
var notistack_1 = require("notistack");
var EnvFormModal_1 = require("@src/components/sdl/EnvFormModal/EnvFormModal");
var EnvVarList_1 = require("@src/components/sdl/EnvVarList");
var browser_env_config_1 = require("@src/config/browser-env.config");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var data_1 = require("@src/utils/sdl/data");
var sdlGenerator_1 = require("@src/utils/sdl/sdlGenerator");
var sdlImport_1 = require("@src/utils/sdl/sdlImport");
var BitBucketBranches_1 = require("../bitbucket/BitBucketBranches");
var GithubBranches_1 = require("../github/GithubBranches");
var GitlabBranches_1 = require("../gitlab/GitlabBranches");
var Rollback_1 = require("./Rollback");
var RemoteDeployUpdate = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    var sdlString = _a.sdlString, onManifestChange = _a.onManifestChange;
    var token = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens)[0];
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var _q = (0, react_1.useState)(false), isEditingEnv = _q[0], setIsEditingEnv = _q[1];
    var _r = (0, react_hook_form_1.useForm)({ defaultValues: { services: [data_1.defaultService] } }), control = _r.control, watch = _r.watch, setValue = _r.setValue;
    var services = (0, react_hook_form_1.useFieldArray)({ control: control, name: "services", keyName: "id" }).fields;
    var envVarUpdater = (0, react_1.useMemo)(function () { return new remote_deployment_controller_service_1.EnvVarUpdater(services); }, [services]);
    (0, react_1.useEffect)(function () {
        var unsubscribe = watch(function (data) {
            var sdl = (0, sdlGenerator_1.generateSdl)(data.services);
            onManifestChange(sdl);
        }).unsubscribe;
        try {
            if (sdlString) {
                var services_1 = createAndValidateSdl(sdlString);
                setValue("services", services_1);
            }
        }
        catch (error) {
            enqueueSnackbar(<components_1.Snackbar title="Error while parsing SDL file"/>, { variant: "error" });
        }
        return function () {
            unsubscribe();
        };
    }, [watch, sdlString]);
    var createAndValidateSdl = function (yamlStr) {
        try {
            return yamlStr ? (0, sdlImport_1.importSimpleSdl)(yamlStr) : [];
        }
        catch (err) {
            if (err.name === "YAMLException" || err.name === "CustomValidationError") {
                enqueueSnackbar(<components_1.Snackbar title={err.message}/>, { variant: "error" });
            }
            else if (err.name === "TemplateValidation") {
                enqueueSnackbar(<components_1.Snackbar title={err.message}/>, { variant: "error" });
            }
            else {
                enqueueSnackbar(<components_1.Snackbar title="Error while parsing SDL file"/>, { variant: "error" });
            }
        }
    };
    return ((_b = services === null || services === void 0 ? void 0 : services[0]) === null || _b === void 0 ? void 0 : _b.image.startsWith(browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_CI_CD_IMAGE_NAME)) && ((_c = services === null || services === void 0 ? void 0 : services[0]) === null || _c === void 0 ? void 0 : _c.env) && ((_e = (_d = services === null || services === void 0 ? void 0 : services[0]) === null || _d === void 0 ? void 0 : _d.env) === null || _e === void 0 ? void 0 : _e.length) > 0 ? (<div className="flex flex-col gap-6 rounded border bg-card px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 rounded border bg-card px-6 py-6 text-card-foreground">
        <div className="flex items-center justify-between gap-5">
          <components_1.Label htmlFor="disable-pull" className="text-base">
            Auto Deploy
          </components_1.Label>

          <components_1.Checkbox id="disable-pull" checked={((_h = (_g = (_f = services[0]) === null || _f === void 0 ? void 0 : _f.env) === null || _g === void 0 ? void 0 : _g.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.DISABLE_PULL; })) === null || _h === void 0 ? void 0 : _h.value) !== "yes"} onCheckedChange={function (value) {
            var pull = !value ? "yes" : "no";
            setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.DISABLE_PULL, pull, false));
            enqueueSnackbar(<components_1.Snackbar title={"Info"} subTitle="You need to click update deployment button to apply changes" iconVariant="info"/>, {
                variant: "info"
            });
        }}/>
        </div>
        <p className="text-sm text-muted-foreground">If checked, Console will automatically re-deploy your app on any code commits</p>
      </div>
      <SdlBuilderProvider_1.SdlBuilderProvider>
        <EnvVarList_1.EnvVarList currentService={services[0]} setIsEditingEnv={setIsEditingEnv} isRemoteDeployEnvHidden/>
      </SdlBuilderProvider_1.SdlBuilderProvider>
      {isEditingEnv && (<EnvFormModal_1.EnvFormModal isUpdate isRemoteDeployEnvHidden control={control} serviceIndex={0} envs={(_k = (_j = services[0]) === null || _j === void 0 ? void 0 : _j.env) !== null && _k !== void 0 ? _k : []} onClose={function () {
                setIsEditingEnv(false);
            }}/>)}

      {token.accessToken && ((_p = (_o = (_m = (_l = services[0]) === null || _l === void 0 ? void 0 : _l.env) === null || _m === void 0 ? void 0 : _m.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.REPO_URL; })) === null || _o === void 0 ? void 0 : _o.value) === null || _p === void 0 ? void 0 : _p.includes(token.type)) && (<>
          <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold">Rollback</h1> <p className="text-muted-foreground">Rollback to a specific commit</p>
            </div>

            <Rollback_1.default control={control} services={services}/>
          </div>
          {(token === null || token === void 0 ? void 0 : token.type) === "github" ? (<GithubBranches_1.default services={services} control={control}/>) : (token === null || token === void 0 ? void 0 : token.type) === "gitlab" ? (<GitlabBranches_1.default control={control} services={services}/>) : (<BitBucketBranches_1.default control={control} services={services}/>)}
        </>)}
    </div>) : null;
};
exports.default = RemoteDeployUpdate;
