"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecDetail = SpecDetail;
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var unitUtils_1 = require("@src/utils/unitUtils");
function SpecDetail(_a) {
    var _b, _c, _d, _e;
    var cpuAmount = _a.cpuAmount, memoryAmount = _a.memoryAmount, storageAmount = _a.storageAmount, _f = _a.gpuAmount, gpuAmount = _f === void 0 ? 0 : _f, gpuModels = _a.gpuModels, _g = _a.color, color = _g === void 0 ? "default" : _g, _h = _a.size, size = _h === void 0 ? "large" : _h, _j = _a.gutterSize, gutterSize = _j === void 0 ? "large" : _j;
    var memory = (0, unitUtils_1.bytesToShrink)(memoryAmount);
    var storage = (0, unitUtils_1.bytesToShrink)(storageAmount);
    var badgeClasses = (0, utils_1.cn)("h-auto rounded-3xl py-0 px-2", (_b = {},
        _b["bg-primary text-white"] = color === "primary",
        _b["bg-secondary text-initial dark:bg-neutral-800"] = color === "secondary",
        _b));
    var specDetailIconClasses = (0, utils_1.cn)((_c = {}, _c["text-2xl"] = size === "large", _c["text-xl"] = size === "medium", _c["text-sm"] = size === "small", _c));
    var specDetailClasses = (0, utils_1.cn)("ml-2", (_d = {}, _d["text-lg"] = size === "large", _d["text-sm"] = size === "medium", _d["text-xs"] = size === "small", _d));
    return (<div className={(0, utils_1.cn)("flex flex-col items-start space-y-1 sm:flex-row sm:items-center sm:space-y-0", (_e = {},
            _e["sm:space-x-1"] = gutterSize === "small",
            _e["sm:space-x-2"] = gutterSize === "medium",
            _e["sm:space-x-3"] = gutterSize === "large",
            _e))}>
      <components_1.Badge className={badgeClasses} variant="outline">
        <div className="flex items-center py-1">
          <md_1.MdSpeed className={specDetailIconClasses}/>
          <div className={specDetailClasses}>{(0, mathHelpers_1.roundDecimal)(cpuAmount, 2) + " CPU"}</div>
        </div>
      </components_1.Badge>

      {gpuAmount > 0 && (<components_1.Badge variant="outline" className={badgeClasses}>
          <div className="flex items-center py-1">
            <md_1.MdDeveloperBoard className={specDetailIconClasses}/>
            <div className={specDetailClasses}>{gpuAmount + " GPU"}</div>
            {gpuModels && (gpuModels === null || gpuModels === void 0 ? void 0 : gpuModels.length) > 0 && (<div className="ml-2 inline-flex items-center space-x-2">
                {gpuModels.map(function (gpu) { return (<components_1.Badge key={"".concat(gpu.vendor, "-").concat(gpu.model)} className="py-0 text-xs" color="default">
                    {"".concat(gpu.vendor, "-").concat(gpu.model)}
                  </components_1.Badge>); })}
              </div>)}
          </div>
        </components_1.Badge>)}

      <components_1.Badge variant="outline" className={badgeClasses}>
        <div className="flex items-center py-1">
          <md_1.MdMemory className={specDetailIconClasses}/>
          <div className={specDetailClasses}>{"".concat((0, mathHelpers_1.roundDecimal)(memory.value, 2), " ").concat(memory.unit)}</div>
        </div>
      </components_1.Badge>

      <components_1.Badge variant="outline" className={badgeClasses}>
        <div className="flex items-center py-1">
          <md_1.MdStorage className={specDetailIconClasses}/>
          <div className={specDetailClasses}>{"".concat((0, mathHelpers_1.roundDecimal)(storage.value, 2), " ").concat(storage.unit)}</div>
        </div>
      </components_1.Badge>
    </div>);
}
