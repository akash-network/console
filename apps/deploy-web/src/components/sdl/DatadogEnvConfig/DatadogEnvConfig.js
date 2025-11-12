"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatadogEnvConfig = exports.datadogEnvSchema = void 0;
var React = require("react");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("zod");
var useSdlEnv_1 = require("@src/hooks/useSdlEnv/useSdlEnv");
exports.datadogEnvSchema = zod_1.z.object({
    DD_API_KEY: zod_1.z.string({ message: "Datadog API key is required." }).min(1, { message: "Datadog API key is required." }).trim(),
    DD_SITE: zod_1.z.string({ message: "Datadog site is required." }).min(1, { message: "Datadog site key is required." }).trim()
});
var DatadogEnvConfig = function (_a) {
    var serviceIndex = _a.serviceIndex, _b = _a.dependencies, d = _b === void 0 ? { useSdlEnv: useSdlEnv_1.useSdlEnv } : _b;
    var env = d.useSdlEnv({ serviceIndex: serviceIndex, schema: exports.datadogEnvSchema });
    return (<>
      <div className="mt-4">
        <components_1.Input value={env.values.DD_SITE} onChange={function (e) { return env.setValue("DD_SITE", e.target.value); }} type="text" label="Regional URL" className="w-full" placeholder="Example: app.datadoghq.com" error={!!env.errors.DD_SITE}/>
        {env.errors.DD_SITE && <p className="mt-2 text-xs font-medium text-destructive">{env.errors.DD_SITE}</p>}
      </div>

      <div className="mt-4">
        <components_1.Input value={env.values.DD_API_KEY} onChange={function (e) { return env.setValue("DD_API_KEY", e.target.value); }} type="password" label="API Key" className="w-full" placeholder="Paste your API key here" error={!!env.errors.DD_API_KEY}/>
        {env.errors.DD_API_KEY && <p className="mt-2 text-xs font-medium text-destructive">{env.errors.DD_API_KEY}</p>}
      </div>
    </>);
};
exports.DatadogEnvConfig = DatadogEnvConfig;
