"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderSpecs = void 0;
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var LabelValue_1 = require("@src/components/shared/LabelValue");
var array_1 = require("@src/utils/array");
var ProviderSpecs = function (_a) {
    var _b;
    var provider = _a.provider;
    var gpuModels = ((_b = provider === null || provider === void 0 ? void 0 : provider.gpuModels) === null || _b === void 0 ? void 0 : _b.map(function (x) { return x.model + " " + x.ram; }).filter((0, array_1.createFilterUnique)()).sort(function (a, b) { return a.localeCompare(b); })) || [];
    return (<components_1.Card>
      <components_1.CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div>
          <LabelValue_1.LabelValue label="GPU" value={provider.hardwareGpuVendor || "Unknown"}/>
          <LabelValue_1.LabelValue label="CPU" value={provider.hardwareCpu || "Unknown"}/>
          <LabelValue_1.LabelValue label="Memory (RAM)" value={provider.hardwareMemory || "Unknown"}/>
          <LabelValue_1.LabelValue label="Persistent Storage" value={provider.featPersistentStorage && <iconoir_react_1.Check className="ml-2 text-primary"/>}/>
          <LabelValue_1.LabelValue label="Download speed" value={provider.networkSpeedDown}/>
          <LabelValue_1.LabelValue label="Network Provider" value={provider.networkProvider}/>
        </div>

        <div>
          <LabelValue_1.LabelValue label="GPU Models" value={gpuModels.map(function (x) { return (<components_1.Badge key={x} className="mr-2">
                {x}
              </components_1.Badge>); })}/>
          <LabelValue_1.LabelValue label="CPU Architecture" value={provider.hardwareCpuArch}/>
          <LabelValue_1.LabelValue label="Disk Storage" value={provider.hardwareDisk}/>
          <LabelValue_1.LabelValue label="Persistent Disk Storage" value={provider.featPersistentStorageType}/>
          <LabelValue_1.LabelValue label="Upload speed" value={provider.networkSpeedUp}/>
        </div>
      </components_1.CardContent>
    </components_1.Card>);
};
exports.ProviderSpecs = ProviderSpecs;
