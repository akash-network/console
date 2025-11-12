"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderListRow = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var useShortText_1 = require("@src/hooks/useShortText");
var array_1 = require("@src/utils/array");
var domUtils_1 = require("@src/utils/domUtils");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var unitUtils_1 = require("@src/utils/unitUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var FavoriteButton_1 = require("../shared/FavoriteButton");
var AuditorButton_1 = require("./AuditorButton");
var CapacityIcon_1 = require("./CapacityIcon");
var Uptime_1 = require("./Uptime");
var ProviderListRow = function (_a) {
    var _b;
    var _c, _d;
    var provider = _a.provider;
    var router = (0, navigation_1.useRouter)();
    var _e = (0, LocalNoteProvider_1.useLocalNotes)(), favoriteProviders = _e.favoriteProviders, updateFavoriteProviders = _e.updateFavoriteProviders;
    var isFavorite = favoriteProviders.some(function (x) { return provider.owner === x; });
    var activeCPU = provider.isOnline ? provider.activeStats.cpu / 1000 : 0;
    var pendingCPU = provider.isOnline ? provider.pendingStats.cpu / 1000 : 0;
    var totalCPU = provider.isOnline ? (provider.availableStats.cpu + provider.pendingStats.cpu + provider.activeStats.cpu) / 1000 : 0;
    var activeGPU = provider.isOnline ? provider.activeStats.gpu : 0;
    var pendingGPU = provider.isOnline ? provider.pendingStats.gpu : 0;
    var totalGPU = provider.isOnline ? provider.availableStats.gpu + provider.pendingStats.gpu + provider.activeStats.gpu : 0;
    var _activeMemory = provider.isOnline ? (0, unitUtils_1.bytesToShrink)(provider.activeStats.memory + provider.pendingStats.memory) : null;
    var _totalMemory = provider.isOnline ? (0, unitUtils_1.bytesToShrink)(provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory) : null;
    var _activeStorage = provider.isOnline ? (0, unitUtils_1.bytesToShrink)(provider.activeStats.storage + provider.pendingStats.storage) : null;
    var _totalStorage = provider.isOnline
        ? (0, unitUtils_1.bytesToShrink)(provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)
        : null;
    var gpuModels = provider.gpuModels.map(function (x) { return x.model; }).filter((0, array_1.createFilterUnique)());
    var onStarClick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        var newFavorites = isFavorite ? favoriteProviders.filter(function (x) { return x !== provider.owner; }) : favoriteProviders.concat([provider.owner]);
        updateFavoriteProviders(newFavorites);
    };
    var onRowClick = function (event) {
        if ((0, domUtils_1.hasSomeParentTheClass)(event.target, "provider-list-row")) {
            router.push(urlUtils_1.UrlService.providerDetail(provider.owner));
        }
    };
    return (<components_1.TableRow className="provider-list-row cursor-pointer hover:bg-muted-foreground/10 [&>td]:px-2 [&>td]:py-1" onClick={onRowClick}>
      {provider.name ? (<components_1.TableCell>
          {((_c = provider.name) === null || _c === void 0 ? void 0 : _c.length) > 20 ? (<components_1.CustomTooltip title={provider.name}>
              <span className="text-xs">{(0, useShortText_1.getSplitText)(provider.name, 4, 13)}</span>
            </components_1.CustomTooltip>) : (<span className="text-xs">{provider.name}</span>)}
        </components_1.TableCell>) : (<components_1.TableCell>
          {((_d = provider.hostUri) === null || _d === void 0 ? void 0 : _d.length) > 20 ? (<components_1.CustomTooltip title={provider.hostUri}>
              <span className="text-xs">{(0, useShortText_1.getSplitText)(provider.hostUri, 4, 13)}</span>
            </components_1.CustomTooltip>) : (<span className="text-xs">{provider.hostUri}</span>)}
        </components_1.TableCell>)}
      <components_1.TableCell className="text-center">
        {provider.ipRegion && provider.ipCountry && (<components_1.CustomTooltip title={<>
                {provider.ipRegion}, {provider.ipCountry}
              </>}>
            <div className="text-xs">
              {provider.ipRegionCode}, {provider.ipCountryCode}
            </div>
          </components_1.CustomTooltip>)}
      </components_1.TableCell>
      <components_1.TableCell className="text-center font-bold">{provider.isOnline && <Uptime_1.Uptime value={provider.uptime7d}/>}</components_1.TableCell>
      <components_1.TableCell className="text-center">
        <components_1.CustomTooltip title={"You have ".concat(provider.userActiveLeases, " active lease").concat((provider.userActiveLeases || 0) > 1 ? "s" : "", " with this provider.")}>
          <div className="inline-flex items-center space-x-1">
            <span>{provider.leaseCount}</span>
            {(provider.userActiveLeases || 0) > 0 && (<span className={(0, utils_1.cn)("text-xs text-muted-foreground", (_b = {},
                _b["font-bold text-primary"] = (provider.userActiveLeases || 0) > 0,
                _b))}>
                &nbsp;({provider.userActiveLeases})
              </span>)}
          </div>
        </components_1.CustomTooltip>
      </components_1.TableCell>
      <components_1.TableCell>
        {provider.isOnline && (<div className="flex items-center">
            <CapacityIcon_1.CapacityIcon value={(activeCPU + pendingCPU) / totalCPU} fontSize="small"/>
            <span className="whitespace-nowrap text-xs">
              {Math.round(activeCPU + pendingCPU)}/{Math.round(totalCPU)}
            </span>
          </div>)}
      </components_1.TableCell>

      <components_1.TableCell align="left">
        {provider.isOnline && (<div className="flex items-center">
            <div className="flex w-[65px] items-center">
              <CapacityIcon_1.CapacityIcon value={(activeGPU + pendingGPU) / totalGPU} fontSize="small"/>
              <span className="whitespace-nowrap text-xs">
                {Math.round(activeGPU + pendingGPU)}/{Math.round(totalGPU)}
              </span>
            </div>
            <div className="mt-1 inline-flex flex-nowrap items-center space-x-1 text-center">
              {gpuModels.slice(0, 2).map(function (gpu) { return (<components_1.Badge key={gpu} className="h-4 px-1 py-0 text-xs">
                  <small>{gpu}</small>
                </components_1.Badge>); })}

              {gpuModels.length > 2 && (<components_1.CustomNoDivTooltip title={<div className="space-x-1">
                      {gpuModels.map(function (gpu) { return (<components_1.Badge key={gpu} className="px-1 py-0 text-xs">
                          {gpu}
                        </components_1.Badge>); })}
                    </div>}>
                  <div className="inline-flex">
                    <components_1.Badge className="h-4 px-1 py-0 text-xs">
                      <small>{"+".concat(gpuModels.length - 2)}</small>
                    </components_1.Badge>
                  </div>
                </components_1.CustomNoDivTooltip>)}
            </div>
          </div>)}
      </components_1.TableCell>

      <components_1.TableCell>
        {provider.isOnline && _activeMemory && _totalMemory && (<div className="flex items-center">
            <CapacityIcon_1.CapacityIcon value={(provider.activeStats.memory + provider.pendingStats.memory) /
                (provider.availableStats.memory + provider.pendingStats.memory + provider.activeStats.memory)} fontSize="small"/>
            <span className="whitespace-nowrap text-xs">
              <Unit value={(0, mathHelpers_1.roundDecimal)(_activeMemory.value, 0)} unit={_activeMemory.unit}/>
              /
              <Unit value={(0, mathHelpers_1.roundDecimal)(_totalMemory.value, 0)} unit={_totalMemory.unit}/>
            </span>
          </div>)}
      </components_1.TableCell>
      <components_1.TableCell>
        {provider.isOnline && _activeStorage && _totalStorage && (<div className="flex items-center">
            <CapacityIcon_1.CapacityIcon value={(provider.activeStats.storage + provider.pendingStats.storage) /
                (provider.availableStats.storage + provider.pendingStats.storage + provider.activeStats.storage)} fontSize="small"/>
            <span className="whitespace-nowrap text-xs">
              <Unit value={(0, mathHelpers_1.roundDecimal)(_activeStorage.value, 0)} unit={_activeStorage.unit}/>
              /
              <Unit value={(0, mathHelpers_1.roundDecimal)(_totalStorage.value, 0)} unit={_totalStorage.unit}/>
            </span>
          </div>)}
      </components_1.TableCell>
      <components_1.TableCell>
        <div className="flex items-center justify-center">
          {provider.isAudited ? (<>
              <span className="text-xs">Yes</span>
              <AuditorButton_1.AuditorButton provider={provider}/>
            </>) : (<>
              <span className="text-xs text-muted-foreground">No</span>
              <iconoir_react_1.WarningCircle className="ml-2 text-xs text-warning"/>
            </>)}
        </div>
      </components_1.TableCell>
      <components_1.TableCell className="text-center">
        <FavoriteButton_1.FavoriteButton isFavorite={isFavorite} onClick={onStarClick}/>
      </components_1.TableCell>
    </components_1.TableRow>);
};
exports.ProviderListRow = ProviderListRow;
var Unit = function (_a) {
    var value = _a.value, unit = _a.unit;
    return (<span>
      {value}
      {value > 0 && <small className="text-muted-foreground">{unit}</small>}
    </span>);
};
