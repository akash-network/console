"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var nanoid_1 = require("nanoid");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var SelectBranches = function (_a) {
    var control = _a.control, loading = _a.loading, branches = _a.branches, selected = _a.selected;
    var _b = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: remote_deploy_config_1.CURRENT_SERVICE,
        keyName: "id"
    }), fields = _b.fields, append = _b.append, update = _b.update;
    var currentBranch = fields.find(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME; });
    return (<div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Branch</h1>
        <p className="text-muted-foreground">Select a branch to use for deployment</p>
      </div>

      <components_1.Select disabled={!selected} value={currentBranch === null || currentBranch === void 0 ? void 0 : currentBranch.value} onValueChange={function (value) {
            var branch = { id: (0, nanoid_1.nanoid)(), key: remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME, value: value, isSecret: false };
            if (currentBranch) {
                update(fields.findIndex(function (e) { return e.key === remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME; }), branch);
            }
            else {
                append(branch);
            }
        }}>
        <components_1.SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {loading && <components_1.Spinner size="small"/>}
            <components_1.SelectValue placeholder="Select"/>
          </div>
        </components_1.SelectTrigger>
        <components_1.SelectContent>
          <components_1.SelectGroup>
            {branches === null || branches === void 0 ? void 0 : branches.map(function (branch) { return (<components_1.SelectItem key={branch.name} value={branch.name}>
                {branch.name}
              </components_1.SelectItem>); })}
          </components_1.SelectGroup>
        </components_1.SelectContent>
      </components_1.Select>
    </div>);
};
exports.default = SelectBranches;
