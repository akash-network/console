"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvVarList = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var FormPaper_1 = require("./FormPaper");
var EnvVarList = function (_a) {
    var _b;
    var currentService = _a.currentService, setIsEditingEnv = _a.setIsEditingEnv, serviceIndex = _a.serviceIndex, isRemoteDeployEnvHidden = _a.isRemoteDeployEnvHidden;
    var hasComponent = (0, SdlBuilderProvider_1.useSdlBuilder)().hasComponent;
    var currentEnvs = (_b = currentService.env) === null || _b === void 0 ? void 0 : _b.filter(function (e) { return !isRemoteDeployEnvHidden || !((e === null || e === void 0 ? void 0 : e.key) in remote_deploy_config_1.protectedEnvironmentVariables); });
    return (<FormPaper_1.FormPaper className={(0, utils_1.cn)("whitespace-break-spaces break-all", isRemoteDeployEnvHidden && "!bg-card")}>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Environment Variables</strong>

        <components_1.CustomTooltip title={<>
              A list of environment variables to expose to the running container.
              {hasComponent("ssh") && (<>
                  <br />
                  <br />
                  Note: The SSH_PUBKEY environment variable is reserved and is going to be overridden by the value provided to the relevant field.
                </>)}
              <br />
              <br />
              <a href="https://akash.network/docs/getting-started/stack-definition-language/#services" target="_blank" rel="noopener">
                View official documentation.
              </a>
            </>}>
          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
        </components_1.CustomTooltip>

        <span className="ml-4 cursor-pointer text-sm font-normal text-primary underline" onClick={function () { return setIsEditingEnv(serviceIndex !== undefined ? serviceIndex : true); }}>
          Edit
        </span>
      </div>

      {(currentEnvs === null || currentEnvs === void 0 ? void 0 : currentEnvs.length) ? (currentEnvs.map(function (e, i) { return (<div key={i} className="text-xs">
            {e.key}=<span className="text-muted-foreground">{e.value}</span>
          </div>); })) : (<p className="text-xs text-muted-foreground">None</p>)}
    </FormPaper_1.FormPaper>);
};
exports.EnvVarList = EnvVarList;
