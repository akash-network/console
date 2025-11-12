"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidRow = exports.COMPONENTS = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var deploymentUtils_1 = require("@src/utils/deploymentUtils");
var domUtils_1 = require("@src/utils/domUtils");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var AuditorButton_1 = require("../../providers/AuditorButton");
var Uptime_1 = require("../../providers/Uptime");
var CopyTextToClipboardButton_1 = require("../../shared/CopyTextToClipboardButton");
var FavoriteButton_1 = require("../../shared/FavoriteButton");
var PriceEstimateTooltip_1 = require("../../shared/PriceEstimateTooltip");
var PricePerMonth_1 = require("../../shared/PricePerMonth");
var ProviderName_1 = require("../../shared/ProviderName");
exports.COMPONENTS = {
    Badge: components_1.Badge,
    CustomTooltip: components_1.CustomTooltip,
    RadioGroup: components_1.RadioGroup,
    RadioGroupItem: components_1.RadioGroupItem,
    Spinner: components_1.Spinner,
    TableCell: components_1.TableCell,
    TableRow: components_1.TableRow,
    PricePerMonth: PricePerMonth_1.PricePerMonth,
    PriceEstimateTooltip: PriceEstimateTooltip_1.PriceEstimateTooltip,
    FavoriteButton: FavoriteButton_1.FavoriteButton,
    ProviderName: ProviderName_1.ProviderName,
    CopyTextToClipboardButton: CopyTextToClipboardButton_1.CopyTextToClipboardButton,
    CloudXmark: iconoir_react_1.CloudXmark,
    Uptime: Uptime_1.Uptime,
    AuditorButton: AuditorButton_1.AuditorButton
};
var BidRow = function (_a) {
    var _b;
    var _c, _d, _e, _f;
    var bid = _a.bid, selectedBid = _a.selectedBid, handleBidSelected = _a.handleBidSelected, disabled = _a.disabled, provider = _a.provider, isSendingManifest = _a.isSendingManifest, _g = _a.components, c = _g === void 0 ? exports.COMPONENTS : _g;
    var _h = (0, LocalNoteProvider_1.useLocalNotes)(), favoriteProviders = _h.favoriteProviders, updateFavoriteProviders = _h.updateFavoriteProviders;
    var isFavorite = provider ? favoriteProviders.some(function (x) { return provider.owner === x; }) : false;
    var isCurrentBid = (selectedBid === null || selectedBid === void 0 ? void 0 : selectedBid.id) === bid.id;
    var _j = (0, useProvidersQuery_1.useProviderStatus)(provider, {
        enabled: false,
        retry: false
    }), isLoadingStatus = _j.isLoading, fetchProviderStatus = _j.refetch, error = _j.error;
    var gpuModels = bid.resourcesOffer.flatMap(function (x) { return (0, deploymentUtils_1.getGpusFromAttributes)(x.resources.gpu.attributes); });
    (0, react_1.useEffect)(function () {
        if (provider) {
            fetchProviderStatus();
        }
    }, [provider, fetchProviderStatus]);
    var onStarClick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (!provider)
            return;
        var newFavorites = isFavorite ? favoriteProviders.filter(function (x) { return x !== provider.owner; }) : favoriteProviders.concat([provider.owner]);
        updateFavoriteProviders(newFavorites);
    };
    var onRowClick = function (event) {
        analytics_service_1.analyticsService.track("bid_selected", "Amplitude");
        if (bid.state === "open" && !disabled && !isSendingManifest && (0, domUtils_1.hasSomeParentTheClass)(event.target, "bid-list-row")) {
            handleBidSelected(bid);
        }
    };
    return (<c.TableRow key={bid.id} className={(0, utils_1.cn)("bid-list-row [&>td]:px-2 [&>td]:py-1", (_b = {},
            _b["cursor-pointer hover:bg-muted-foreground/10"] = bid.state === "open",
            _b["border bg-green-100 dark:bg-green-900"] = isCurrentBid,
            _b))} onClick={onRowClick}>
      <c.TableCell align="center">
        <div className="flex items-center justify-center whitespace-nowrap">
          <c.PricePerMonth denom={bid.price.denom} perBlockValue={(0, mathHelpers_1.udenomToDenom)(bid.price.amount, 10)} className="text-xl"/>
          <c.PriceEstimateTooltip denom={bid.price.denom} value={bid.price.amount}/>
        </div>
      </c.TableCell>

      <c.TableCell align="center">
        {(provider === null || provider === void 0 ? void 0 : provider.ipRegion) && (provider === null || provider === void 0 ? void 0 : provider.ipCountry) ? (<c.CustomTooltip title={<>
                {provider.ipRegion}, {provider.ipCountry}
              </>}>
            <div>
              {provider.ipRegionCode}, {provider.ipCountryCode}
            </div>
          </c.CustomTooltip>) : (<div>-</div>)}
      </c.TableCell>

      <c.TableCell align="center" className="font-bold">
        {(provider === null || provider === void 0 ? void 0 : provider.uptime7d) ? <c.Uptime value={provider.uptime7d}/> : <div>-</div>}
      </c.TableCell>

      <c.TableCell align="left">
        <div className="flex items-center">
          <c.FavoriteButton isFavorite={isFavorite} onClick={onStarClick}/>
          <div className="ml-2">{provider ? <c.ProviderName provider={provider}/> : <div>-</div>}</div>
          <div className="pl-2">
            <c.CopyTextToClipboardButton value={(_d = (_c = provider === null || provider === void 0 ? void 0 : provider.name) !== null && _c !== void 0 ? _c : provider === null || provider === void 0 ? void 0 : provider.hostUri) !== null && _d !== void 0 ? _d : "-"}/>
          </div>
        </div>
      </c.TableCell>

      {gpuModels.length > 0 && (<c.TableCell align="center">
          <div className="space-x">
            {gpuModels.map(function (gpu) { return (<c.Badge key={"".concat(gpu.vendor, "-").concat(gpu.model)} className={(0, utils_1.cn)("px-1 py-0 text-xs")} variant="default">
                {gpu.vendor}-{gpu.model}
              </c.Badge>); })}
          </div>
        </c.TableCell>)}

      <c.TableCell align="center">
        {(provider === null || provider === void 0 ? void 0 : provider.isAudited) ? (<div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Yes</span>
            <div className="ml-1">
              <c.AuditorButton provider={provider}/>
            </div>
          </div>) : (<div className="flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No</span>

            <c.CustomTooltip title={<>This provider is not audited, which may result in a lesser quality experience.</>}>
              <iconoir_react_1.WarningTriangle className="ml-2 text-sm text-orange-600"/>
            </c.CustomTooltip>
          </div>)}
      </c.TableCell>

      <c.TableCell align="center">
        <div className="flex h-[38px] items-center justify-center">
          {isLoadingStatus && (<div className="flex items-center justify-center">
              <c.Spinner size="small"/>
            </div>)}
          {!isLoadingStatus && !!error && !isSendingManifest && (<div className="mt-2 flex items-center space-x-2">
              <c.CloudXmark className="text-xs text-primary"/>
              <span className="text-sm text-muted-foreground">OFFLINE</span>
            </div>)}

          {!isLoadingStatus && !error && !isSendingManifest && (<>
              {bid.state !== "open" || disabled ? (<div className="flex items-center justify-center">
                  <c.Badge color={bid.state === "active" ? "success" : "error"} className="h-4 text-xs">
                    {bid.state}
                  </c.Badge>
                </div>) : (<c.RadioGroup>
                  <c.RadioGroupItem value={bid.id} id={bid.id} checked={isCurrentBid} onChange={function () { return handleBidSelected(bid); }} disabled={bid.state !== "open" || disabled} aria-label={(_f = (_e = provider === null || provider === void 0 ? void 0 : provider.name) !== null && _e !== void 0 ? _e : provider === null || provider === void 0 ? void 0 : provider.hostUri) !== null && _f !== void 0 ? _f : "Unknown Provider"}/>
                </c.RadioGroup>)}
            </>)}

          {isSendingManifest && isCurrentBid && (<div className="flex items-center justify-center whitespace-nowrap">
              <c.Badge variant="success">Deploying! 🚀</c.Badge>
            </div>)}
        </div>
      </c.TableCell>
    </c.TableRow>);
};
exports.BidRow = BidRow;
