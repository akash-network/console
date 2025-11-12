"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var EnvFormModal_1 = require("../../sdl/EnvFormModal/EnvFormModal");
var EnvVarList_1 = require("../../sdl/EnvVarList");
var RemoteDeployEnvDropdown = function (_a) {
    var _b;
    var services = _a.services, control = _a.control;
    var serviceIndex = 0;
    var _c = (0, react_1.useState)(false), expanded = _c[0], setExpanded = _c[1];
    var currentService = services[serviceIndex];
    var _d = (0, react_1.useState)(null), isEditingEnv = _d[0], setIsEditingEnv = _d[1];
    return (<components_1.Collapsible open={expanded} onOpenChange={function (value) {
            setExpanded(value);
        }}>
      <components_1.Card className="mt-4 rounded-sm border border-muted-foreground/20">
        <components_1.CardContent className="p-0">
          <components_1.CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4">
              <h1 className="font-semibold">{!expanded && "Environment Variables"}</h1>
              <iconoir_react_1.NavArrowDown fontSize="1rem" className={(0, utils_1.cn)("transition-all duration-100", (_b = {}, _b["rotate-180"] = expanded, _b))}/>
            </div>
          </components_1.CollapsibleTrigger>
          {expanded && <components_1.Separator />}
          <components_1.CollapsibleContent>
            <div className="grid items-start gap-6 p-5">
              {isEditingEnv === serviceIndex && (<EnvFormModal_1.EnvFormModal isRemoteDeployEnvHidden control={control} onClose={function () { return setIsEditingEnv(null); }} serviceIndex={serviceIndex} envs={currentService.env || []}/>)}
              <div>
                <EnvVarList_1.EnvVarList isRemoteDeployEnvHidden currentService={currentService} setIsEditingEnv={setIsEditingEnv} serviceIndex={serviceIndex}/>
              </div>
            </div>
          </components_1.CollapsibleContent>
        </components_1.CardContent>
      </components_1.Card>
    </components_1.Collapsible>);
};
exports.default = RemoteDeployEnvDropdown;
