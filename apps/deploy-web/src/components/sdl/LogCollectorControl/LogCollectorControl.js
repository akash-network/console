"use strict";
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
exports.LogCollectorControl = void 0;
exports.isLogCollectorService = isLogCollectorService;
exports.findOwnLogCollectorServiceIndex = findOwnLogCollectorServiceIndex;
var react_1 = require("react");
var react_2 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var zod_1 = require("zod");
var CpuFormControl_1 = require("@src/components/sdl/CpuFormControl");
var DatadogEnvConfig_1 = require("@src/components/sdl/DatadogEnvConfig/DatadogEnvConfig");
var EphemeralStorageFormControl_1 = require("@src/components/sdl/EphemeralStorageFormControl");
var MemoryFormControl_1 = require("@src/components/sdl/MemoryFormControl");
var useSdlEnv_1 = require("@src/hooks/useSdlEnv/useSdlEnv");
var useThrottledEffect_1 = require("@src/hooks/useThrottledEffect/useThrottledEffect");
var switchStore = (0, jotai_1.atom)({});
var useSwitch = function (key, initial) {
    var _a;
    var _b = (0, jotai_1.useAtom)(switchStore), prev = _b[0], set = _b[1];
    return [(_a = prev[key]) !== null && _a !== void 0 ? _a : initial, function (value) {
            var _a;
            return set(__assign(__assign({}, prev), (_a = {}, _a[key] = value, _a)));
        }];
};
var logCollectorLabelSchema = zod_1.z.object({
    POD_LABEL_SELECTOR: zod_1.z.string()
});
var LogCollectorControl = function (_a) {
    var serviceIndex = _a.serviceIndex, _b = _a.dependencies, d = _b === void 0 ? { useSdlEnv: useSdlEnv_1.useSdlEnv } : _b;
    var _c = (0, react_1.useState)(false), isAdding = _c[0], setIsAdding = _c[1];
    var _d = (0, react_hook_form_1.useFormContext)(), watch = _d.watch, control = _d.control;
    var _e = (0, react_hook_form_1.useFieldArray)({ name: "services" }), append = _e.append, remove = _e.remove, update = _e.update;
    var allServices = watch("services");
    var targetService = allServices[serviceIndex];
    var logCollectorServiceIndex = (0, react_2.useMemo)(function () { return allServices.findIndex(function (service) { return targetService && (service === null || service === void 0 ? void 0 : service.title) === toLogCollectorTitle(targetService); }); }, [allServices, targetService]);
    var logCollectorService = (0, react_2.useMemo)(function () { return allServices[logCollectorServiceIndex]; }, [allServices, logCollectorServiceIndex]);
    var _f = useSwitch(targetService.title, logCollectorServiceIndex !== -1), isEnabled = _f[0], setIsEnabled = _f[1];
    var env = d.useSdlEnv({ serviceIndex: logCollectorServiceIndex, schema: logCollectorLabelSchema });
    (0, useThrottledEffect_1.useThrottledEffect)(function trackTargetNameAndPlacement() {
        if (logCollectorServiceIndex === -1) {
            return;
        }
        var nextTitle = toLogCollectorTitle(targetService);
        var changes = {};
        if (logCollectorService.title !== nextTitle) {
            changes.title = nextTitle;
        }
        if (targetService.placement.name !== logCollectorService.placement.name) {
            changes.placement = targetService.placement;
        }
        if (Object.keys(changes).length > 0) {
            update(logCollectorServiceIndex, __assign(__assign({}, logCollectorService), changes));
        }
    }, [logCollectorService, logCollectorServiceIndex, targetService.placement.name, targetService.title, update, env]);
    (0, useThrottledEffect_1.useThrottledEffect)(function () {
        var nextTitle = "\"akash.network/manifest-service=".concat(targetService.title, "\"");
        if (env.values.POD_LABEL_SELECTOR !== nextTitle) {
            env.setValue("POD_LABEL_SELECTOR", nextTitle);
        }
    }, [env, targetService.title]);
    (0, react_1.useEffect)(function addWhenEnabledAndGenerated() {
        if (isEnabled && logCollectorServiceIndex === -1) {
            setIsAdding(true);
            append(logCollectorService || generateLogCollectorService(targetService));
        }
    }, [isEnabled, logCollectorService, allServices, logCollectorServiceIndex, append, remove, setIsAdding, targetService]);
    (0, react_1.useEffect)(function finalizeAdding() {
        if (isAdding && logCollectorServiceIndex !== -1) {
            setIsAdding(false);
        }
    }, [isAdding, logCollectorServiceIndex]);
    (0, react_1.useEffect)(function removeWhenDisabled() {
        if (!isEnabled && !isAdding && logCollectorServiceIndex !== -1) {
            remove(logCollectorServiceIndex);
        }
    }, [isEnabled, logCollectorService, allServices, logCollectorServiceIndex, append, remove, isAdding]);
    return (<>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Log Forwarding</strong>
        <components_1.CustomTooltip title={<>
              Log forwarding adds an additional service that collects logs from the primary service and forwards them to third-party monitoring services like
              Datadog.
            </>}>
          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
        </components_1.CustomTooltip>
      </div>
      <components_1.CheckboxWithLabel checked={isEnabled} onCheckedChange={function (state) { return setIsEnabled(state === "indeterminate" ? false : state); }} className="ml-4" label="Enable log forwarding for this service"/>{" "}
      {!isAdding && logCollectorService && (<div>
          <div>
            <components_1.FormLabel htmlFor="provider" className="mb-2 mt-4 flex items-center">
              Provider
              <components_1.CustomTooltip title={<>We are actively working on adding support for more providers.</>}>
                <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
              </components_1.CustomTooltip>
            </components_1.FormLabel>
            <components_1.Select value="DATADOG" disabled>
              <components_1.SelectTrigger id="provider">
                <components_1.SelectValue placeholder="Select Provider"/>
              </components_1.SelectTrigger>
              <components_1.SelectContent>
                <components_1.SelectGroup>
                  <components_1.SelectItem value="DATADOG">Datadog</components_1.SelectItem>
                </components_1.SelectGroup>
              </components_1.SelectContent>
            </components_1.Select>
          </div>

          <DatadogEnvConfig_1.DatadogEnvConfig serviceIndex={logCollectorServiceIndex}/>

          <div className="mt-4">
            <CpuFormControl_1.CpuFormControl control={control} currentService={logCollectorService} serviceIndex={logCollectorServiceIndex}/>
          </div>

          <div className="mt-4">
            <MemoryFormControl_1.MemoryFormControl control={control} serviceIndex={logCollectorServiceIndex}/>
          </div>

          <div className="mt-4">
            <EphemeralStorageFormControl_1.EphemeralStorageFormControl services={allServices} control={control} serviceIndex={logCollectorServiceIndex}/>
          </div>
        </div>)}
    </>);
};
exports.LogCollectorControl = LogCollectorControl;
var IMAGE = "ghcr.io/akash-network/log-collector:1.7.0";
function isLogCollectorService(service) {
    return service.title.endsWith("-log-collector") && service.image === IMAGE;
}
function findOwnLogCollectorServiceIndex(service, services) {
    return services.findIndex(function (s) { return s.title === toLogCollectorTitle(service); });
}
function generateLogCollectorService(targetService) {
    return {
        id: toLogCollectorId(targetService),
        title: toLogCollectorTitle(targetService),
        image: IMAGE,
        placement: targetService.placement,
        env: [
            { key: "PROVIDER", value: "DATADOG" },
            { key: "POD_LABEL_SELECTOR", value: "\"akash.network/manifest-service=".concat(targetService.title, "\"") },
            { key: "DD_API_KEY", value: "" },
            { key: "DD_SITE", value: "" }
        ],
        profile: {
            cpu: 0.1,
            ram: 256,
            ramUnit: "Mi",
            storage: [
                {
                    size: 512,
                    unit: "Mi",
                    isPersistent: true
                }
            ],
            hasGpu: false,
            gpu: 0
        },
        expose: [],
        count: 1
    };
}
function toLogCollectorTitle(service) {
    return "".concat(service.title, "-log-collector");
}
function toLogCollectorId(service) {
    return "".concat(service.id, "-log-collector");
}
