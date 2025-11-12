"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvFormModal = exports.COMPONENTS = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var FormPaper_1 = require("../FormPaper");
exports.COMPONENTS = {
    FormPaper: FormPaper_1.FormPaper,
    Popup: components_1.Popup,
    FormField: components_1.FormField,
    FormInput: components_1.FormInput,
    Button: components_1.Button,
    CustomNoDivTooltip: components_1.CustomNoDivTooltip,
    Controller: react_hook_form_1.Controller,
    Switch: components_1.Switch
};
var EnvFormModal = function (_a) {
    var control = _a.control, serviceIndex = _a.serviceIndex, _envs = _a.envs, onClose = _a.onClose, _b = _a.hasSecretOption, hasSecretOption = _b === void 0 ? true : _b, isRemoteDeployEnvHidden = _a.isRemoteDeployEnvHidden, isUpdate = _a.isUpdate, _c = _a.components, c = _c === void 0 ? exports.COMPONENTS : _c;
    var _d = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".env"),
        keyName: "id"
    }), envs = _d.fields, removeEnv = _d.remove, appendEnv = _d.append, updateEnv = _d.update;
    var filteredEnvs = envs === null || envs === void 0 ? void 0 : envs.filter(function (e) { var _a; return !isRemoteDeployEnvHidden || !(((_a = e === null || e === void 0 ? void 0 : e.key) === null || _a === void 0 ? void 0 : _a.trim()) in remote_deploy_config_1.protectedEnvironmentVariables); });
    (0, react_1.useEffect)(function () {
        var noEnvsExist = _envs.length === 0;
        var noUserAddedEnvs = _envs.filter(function (e) { var _a; return !(((_a = e === null || e === void 0 ? void 0 : e.key) === null || _a === void 0 ? void 0 : _a.trim()) in remote_deploy_config_1.protectedEnvironmentVariables); }).length === 0;
        var shouldAddEnv = noEnvsExist || (isRemoteDeployEnvHidden && noUserAddedEnvs && !isUpdate);
        if (shouldAddEnv) {
            onAddEnv();
        }
    }, []);
    var onAddEnv = (0, react_1.useCallback)(function () {
        appendEnv({ id: (0, nanoid_1.nanoid)(), key: "", value: "", isSecret: false });
    }, [appendEnv]);
    var _onClose = (0, react_1.useCallback)(function () {
        var _envToRemove = [];
        _envs.forEach(function (e, i) {
            if (!e.key.trim()) {
                _envToRemove.push(i);
            }
        });
        removeEnv(_envToRemove);
        onClose();
    }, [onClose, removeEnv, _envs]);
    var updateEnvVars = (0, react_1.useCallback)(function (event, focusedEnvIndex) {
        var _a, _b;
        var pastedText = (_a = event.clipboardData.getData("text")) === null || _a === void 0 ? void 0 : _a.trim();
        if (!pastedText || !pastedText.includes("="))
            return;
        var lines = pastedText.split("\n");
        var didUpdate = false;
        lines.forEach(function (line) {
            var equalsIndex = line.indexOf("=");
            if (equalsIndex === -1)
                return;
            var key = line.slice(0, equalsIndex).trim();
            var value = line.slice(equalsIndex + 1).trim();
            if (!key || key in remote_deploy_config_1.protectedEnvironmentVariables)
                return;
            didUpdate = true;
            var existingEnvIndex = filteredEnvs.findIndex(function (env) { return env.key === key; });
            if (existingEnvIndex === -1) {
                appendEnv({ id: (0, nanoid_1.nanoid)(), key: key, value: value, isSecret: false });
            }
            else {
                updateEnv(existingEnvIndex, __assign(__assign({}, filteredEnvs[existingEnvIndex]), { value: value }));
            }
        });
        if (didUpdate) {
            event.preventDefault();
            if (!((_b = filteredEnvs[focusedEnvIndex]) === null || _b === void 0 ? void 0 : _b.key.trim())) {
                removeEnv(focusedEnvIndex);
            }
        }
    }, [appendEnv, filteredEnvs, removeEnv, updateEnv]);
    var clearOrRemoveEnv = (0, react_1.useCallback)(function (envIndex) {
        if (filteredEnvs.length > 1) {
            removeEnv(envIndex);
        }
        else {
            updateEnv(envIndex, { key: "", value: "", isSecret: false });
        }
    }, [filteredEnvs, removeEnv, updateEnv]);
    return (<c.Popup fullWidth open variant="custom" title="Edit Environment Variables" actions={[
            {
                label: "Close",
                color: "primary",
                variant: "ghost",
                side: "left",
                onClick: _onClose
            },
            {
                label: "Add Variable",
                color: "secondary",
                variant: "default",
                side: "right",
                onClick: onAddEnv
            }
        ]} onClose={_onClose} maxWidth="md" enableCloseOnBackdropClick>
      <c.FormPaper className="!bg-popover">
        {filteredEnvs === null || filteredEnvs === void 0 ? void 0 : filteredEnvs.map(function (env, envIndex) {
            var _a, _b;
            var currentEnvIndex = envs.findIndex(function (e) { return e.id === env.id; });
            var isLastEnv = envIndex + 1 === filteredEnvs.length;
            return (<div key={env.id} className={(0, utils_1.cn)("flex", (_a = {}, _a["mb-2"] = !isLastEnv, _a))}>
              <div className="flex flex-grow flex-col items-end sm:flex-row">
                <c.FormField control={control} name={"services.".concat(serviceIndex, ".env.").concat(currentEnvIndex, ".key")} render={function (_a) {
                    var field = _a.field;
                    return (<div className="basis-[40%]">
                      <c.FormInput type="text" label="Key" color="secondary" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }} onPaste={function (event) { return updateEnvVars(event, currentEnvIndex); }} className="w-full"/>
                    </div>);
                }}/>

                <c.FormField control={control} name={"services.".concat(serviceIndex, ".env.").concat(currentEnvIndex, ".value")} render={function (_a) {
                    var field = _a.field;
                    return (<div className="ml-2 flex-grow">
                      <c.FormInput type="text" label="Value" color="secondary" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }} className="w-full"/>
                    </div>);
                }}/>
              </div>

              <div className={(0, utils_1.cn)("flex w-[50px] flex-col items-start pl-2", (_b = {},
                    _b["justify-between"] = envIndex > 0,
                    _b["justify-end"] = envIndex === 0 || !hasSecretOption,
                    _b))}>
                {(filteredEnvs.length > 1 || env.key.trim()) && (<c.Button onClick={function () { return clearOrRemoveEnv(currentEnvIndex); }} size="icon" variant="ghost" aria-label="Delete Environment Variable">
                    <iconoir_react_1.Bin />
                  </c.Button>)}

                {hasSecretOption && (<c.Controller control={control} name={"services.".concat(serviceIndex, ".env.").concat(currentEnvIndex, ".isSecret")} render={function (_a) {
                        var field = _a.field;
                        return (<c.CustomNoDivTooltip title={<>
                            <p>
                              <strong>Secret</strong>
                            </p>
                            <p className="text-sm">
                              This is for secret variables containing sensitive information you don't want to be saved in your template.
                            </p>
                          </>}>
                        <c.Switch checked={!!field.value} onCheckedChange={field.onChange}/>
                      </c.CustomNoDivTooltip>);
                    }}/>)}
              </div>
            </div>);
        })}
      </c.FormPaper>
    </c.Popup>);
};
exports.EnvFormModal = EnvFormModal;
