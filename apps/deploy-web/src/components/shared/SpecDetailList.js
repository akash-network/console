"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecDetailList = SpecDetailList;
var md_1 = require("react-icons/md");
var utils_1 = require("@akashnetwork/ui/utils");
var LinearProgress_1 = require("@mui/material/LinearProgress");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var unitUtils_1 = require("@src/utils/unitUtils");
function SpecDetailList(_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var cpuAmount = _a.cpuAmount, memoryAmount = _a.memoryAmount, storageAmount = _a.storageAmount, _p = _a.gpuAmount, gpuAmount = _p === void 0 ? 0 : _p, isActive = _a.isActive;
    var memory = (0, unitUtils_1.bytesToShrink)(memoryAmount);
    var storage = (0, unitUtils_1.bytesToShrink)(storageAmount);
    var activeColorClasses = "";
    var serverRowClasses = " w-[110px] text-center flex items-center py-[2px] px-[4px] space-x-2";
    var defaultColorClasses = "text-muted-foreground border-muted-foreground/20";
    var activeIconClasses = "opacity-100 text-primary";
    var specIconClasses = "text-lg flex-shrink-0";
    var specDetailClasses = "flex-grow text-left text-xs leading-3 whitespace-nowrap";
    return (<div className="inline-flex flex-col flex-nowrap items-center divide-y overflow-hidden rounded-md border bg-popover p-0">
      {isActive && <LinearProgress_1.default className="h-[2px] w-full opacity-30"/>}

      <div className={(0, utils_1.cn)(serverRowClasses, defaultColorClasses, (_b = {}, _b[activeColorClasses] = isActive, _b))}>
        <md_1.MdSpeed className={(0, utils_1.cn)(specIconClasses, defaultColorClasses, (_c = {}, _c[activeColorClasses] = isActive, _c[activeIconClasses] = isActive, _c))}/>
        <div className={(0, utils_1.cn)(specDetailClasses, defaultColorClasses, (_d = {}, _d[activeColorClasses] = isActive, _d))}>{(0, mathHelpers_1.roundDecimal)(cpuAmount, 2) + " cpu"}</div>
      </div>

      {gpuAmount > 0 && (<div className={(0, utils_1.cn)(serverRowClasses, defaultColorClasses, (_e = {}, _e[activeColorClasses] = isActive, _e))}>
          <md_1.MdDeveloperBoard className={(0, utils_1.cn)(specIconClasses, defaultColorClasses, (_f = {}, _f[activeColorClasses] = isActive, _f[activeIconClasses] = isActive, _f))}/>
          <div className={(0, utils_1.cn)(specDetailClasses, defaultColorClasses, (_g = {}, _g[activeColorClasses] = isActive, _g))}>{gpuAmount + " gpu"}</div>
        </div>)}

      <div className={(0, utils_1.cn)(serverRowClasses, defaultColorClasses, (_h = {}, _h[activeColorClasses] = isActive, _h))}>
        <md_1.MdMemory className={(0, utils_1.cn)(specIconClasses, defaultColorClasses, (_j = {}, _j[activeColorClasses] = isActive, _j[activeIconClasses] = isActive, _j))}/>
        <div className={(0, utils_1.cn)(specDetailClasses, defaultColorClasses, (_k = {}, _k[activeColorClasses] = isActive, _k))}>{"".concat((0, mathHelpers_1.roundDecimal)(memory.value, 2), " ").concat(memory.unit)}</div>
      </div>

      <div className={(0, utils_1.cn)(serverRowClasses, defaultColorClasses, (_l = {}, _l[activeColorClasses] = isActive, _l))}>
        <md_1.MdStorage className={(0, utils_1.cn)(specIconClasses, defaultColorClasses, (_m = {}, _m[activeColorClasses] = isActive, _m[activeIconClasses] = isActive, _m))}/>
        <div className={(0, utils_1.cn)(specDetailClasses, defaultColorClasses, (_o = {}, _o[activeColorClasses] = isActive, _o))}>{"".concat((0, mathHelpers_1.roundDecimal)(storage.value, 2), " ").concat(storage.unit)}</div>
      </div>
    </div>);
}
