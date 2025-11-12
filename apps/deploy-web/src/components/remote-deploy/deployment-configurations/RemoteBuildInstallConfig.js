"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var remote_deployment_controller_service_1 = require("@src/services/remote-deploy/remote-deployment-controller.service");
var BoxTextInput_1 = require("../BoxTextInput");
var RemoteBuildInstallConfig = function (_a) {
    var _b;
    var _c, _d;
    var services = _a.services, setValue = _a.setValue;
    var _e = (0, react_1.useState)(false), expanded = _e[0], setExpanded = _e[1];
    var currentService = services[0];
    var envVarUpdater = (0, react_1.useMemo)(function () { return new remote_deployment_controller_service_1.EnvVarUpdater(services); }, [services]);
    return (<components_1.Collapsible open={expanded} onOpenChange={function (value) {
            setExpanded(value);
        }}>
      <components_1.Card className="mt-4 rounded-sm border border-muted-foreground/20">
        <components_1.CardContent className="p-0">
          <components_1.CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4">
              <h1 className="font-semibold">Build & Install Configurations</h1>
              <iconoir_react_1.NavArrowDown fontSize="1rem" className={(0, utils_1.cn)("transition-all duration-100", (_b = {}, _b["rotate-180"] = expanded, _b))}/>
            </div>
          </components_1.CollapsibleTrigger>
          {expanded && <components_1.Separator />}
          <components_1.CollapsibleContent>
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <BoxTextInput_1.default onChange={function (e) {
            return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.INSTALL_COMMAND, e.target.value, false));
        }} label="Install Command" placeholder="npm install"/>
              <BoxTextInput_1.default onChange={function (e) {
            return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.BUILD_DIRECTORY, e.target.value, false));
        }} label="Build Directory" placeholder="dist"/>
              <BoxTextInput_1.default onChange={function (e) {
            return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.BUILD_COMMAND, e.target.value, false));
        }} label="Build Command" placeholder="npm run build"/>
              <BoxTextInput_1.default onChange={function (e) {
            return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.CUSTOM_SRC, e.target.value, false));
        }} label="Start Command" placeholder="npm start"/>
              <BoxTextInput_1.default onChange={function (e) {
            return setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.NODE_VERSION, e.target.value, false));
        }} label="Node Version" placeholder="21"/>
              <div className="flex flex-col gap-3 rounded border bg-card px-6 py-6 text-card-foreground">
                <div className="flex items-center justify-between gap-5">
                  <components_1.Label htmlFor="disable-pull" className="text-base">
                    Auto Deploy
                  </components_1.Label>

                  <components_1.Checkbox checked={((_d = (_c = currentService === null || currentService === void 0 ? void 0 : currentService.env) === null || _c === void 0 ? void 0 : _c.find(function (env) { return env.key === remote_deploy_config_1.protectedEnvironmentVariables.DISABLE_PULL; })) === null || _d === void 0 ? void 0 : _d.value) !== "yes"} id="disable-pull" defaultChecked={false} onCheckedChange={function (value) {
            var pull = !value ? "yes" : "no";
            setValue(remote_deploy_config_1.CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(remote_deploy_config_1.protectedEnvironmentVariables.DISABLE_PULL, pull, false));
        }}/>
                </div>
                <p className="text-sm text-muted-foreground">If checked, Console will automatically re-deploy your app on any code commits</p>
              </div>
            </div>
          </components_1.CollapsibleContent>
        </components_1.CardContent>
      </components_1.Card>
    </components_1.Collapsible>);
};
exports.default = RemoteBuildInstallConfig;
