"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedConfig = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var ExpandMore_1 = require("../shared/ExpandMore");
var EnvFormModal_1 = require("./EnvFormModal/EnvFormModal");
var CommandFormModal_1 = require("./CommandFormModal");
var CommandList_1 = require("./CommandList");
var EnvVarList_1 = require("./EnvVarList");
var ExposeFormModal_1 = require("./ExposeFormModal");
var ExposeList_1 = require("./ExposeList");
var MountedStorageFormControl_1 = require("./MountedStorageFormControl");
var AdvancedConfig = function (_a) {
    var control = _a.control, currentService = _a.currentService, storages = _a.storages, setValue = _a.setValue, appendStorage = _a.appendStorage, removeStorage = _a.removeStorage;
    var _b = (0, react_1.useState)(false), expanded = _b[0], setIsAdvancedOpen = _b[1];
    var _c = (0, react_1.useState)(false), isEditingCommands = _c[0], setIsEditingCommands = _c[1];
    var _d = (0, react_1.useState)(false), isEditingEnv = _d[0], setIsEditingEnv = _d[1];
    var _e = (0, react_1.useState)(false), isEditingExpose = _e[0], setIsEditingExpose = _e[1];
    (0, react_1.useEffect)(function () {
        currentService.profile.storage.length > 1 && setIsAdvancedOpen(true);
    }, [currentService.profile.storage]);
    return (<components_1.Card className="mt-4">
      <components_1.CardContent className="p-0">
        {/** Edit Environment Variables */}
        {isEditingEnv && (<EnvFormModal_1.EnvFormModal control={control} onClose={function () { return setIsEditingEnv(false); }} serviceIndex={0} envs={currentService.env || []} hasSecretOption={false}/>)}
        {/** Edit Commands */}
        {isEditingCommands && <CommandFormModal_1.CommandFormModal control={control} onClose={function () { return setIsEditingCommands(false); }} serviceIndex={0}/>}
        {/** Edit Expose */}
        {isEditingExpose && (<ExposeFormModal_1.ExposeFormModal control={control} onClose={function () { return setIsEditingExpose(false); }} serviceIndex={0} expose={currentService.expose} services={[currentService]}/>)}

        <components_1.Collapsible open={expanded} onOpenChange={setIsAdvancedOpen}>
          <components_1.CollapsibleTrigger asChild>
            <components_1.Button size="lg" variant="ghost" className={(0, utils_1.cn)("flex w-full items-center justify-between p-4 normal-case", { "border-b border-muted": expanded })} type="button">
              <div>
                <p>Advanced Configuration</p>
              </div>

              <ExpandMore_1.ExpandMore expand={expanded} aria-expanded={expanded} aria-label="show more" className="ml-2"/>
            </components_1.Button>
          </components_1.CollapsibleTrigger>
          <components_1.CollapsibleContent>
            <div className="p-4">
              {currentService.profile.storage.length > 1 &&
            (storages || []).slice(1).map(function (storage, storageIndex) { return (<div key={"storage-".concat(storage.id)}>
                    <div className="mb-4">
                      <MountedStorageFormControl_1.MountedStorageFormControl services={[currentService]} control={control} currentService={currentService} serviceIndex={0} storageIndex={storageIndex + 1} appendStorage={appendStorage} removeStorage={removeStorage} setValue={setValue}/>
                    </div>
                  </div>); })}

              <div className="mb-4">
                <ExposeList_1.ExposeList currentService={currentService} setIsEditingExpose={function () { return setIsEditingExpose(true); }}/>
              </div>
              <div className="mb-4">
                <EnvVarList_1.EnvVarList currentService={currentService} setIsEditingEnv={function () { return setIsEditingEnv(true); }}/>
              </div>
              <div className="mb-4">
                <CommandList_1.CommandList currentService={currentService} setIsEditingCommands={function () { return setIsEditingCommands(true); }}/>
              </div>
            </div>
          </components_1.CollapsibleContent>
        </components_1.Collapsible>
      </components_1.CardContent>
    </components_1.Card>);
};
exports.AdvancedConfig = AdvancedConfig;
