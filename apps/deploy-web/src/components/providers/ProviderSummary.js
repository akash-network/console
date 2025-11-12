"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderSummary = void 0;
var components_1 = require("@akashnetwork/ui/components");
var AuditorButton_1 = require("@src/components/providers/AuditorButton");
var Uptime_1 = require("@src/components/providers/Uptime");
var FavoriteButton_1 = require("@src/components/shared/FavoriteButton");
var LabelValue_1 = require("@src/components/shared/LabelValue");
var StatusPill_1 = require("@src/components/shared/StatusPill");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var ProviderMap_1 = require("./ProviderMap");
var ProviderSummary = function (_a) {
    var provider = _a.provider;
    var _b = (0, LocalNoteProvider_1.useLocalNotes)(), favoriteProviders = _b.favoriteProviders, updateFavoriteProviders = _b.updateFavoriteProviders;
    var isFavorite = favoriteProviders.some(function (x) { return provider.owner === x; });
    var onStarClick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        var newFavorites = isFavorite ? favoriteProviders.filter(function (x) { return x !== provider.owner; }) : favoriteProviders.concat([provider.owner]);
        updateFavoriteProviders(newFavorites);
    };
    return (<components_1.Card className="overflow-hidden rounded-b-none">
      <components_1.CardContent className="p-0">
        <div className="flex flex-col lg:flex-row lg:justify-between">
          <div className="flex-grow-1 p-4">
            {provider.name && <LabelValue_1.LabelValue label="Name" value={provider.name}/>}
            <LabelValue_1.LabelValue label="Uri" value={provider.hostUri}/>
            <LabelValue_1.LabelValue label="Address" value={<components_1.Address address={provider.owner} isCopyable/>}/>
            <LabelValue_1.LabelValue label="Region" value={provider.ipRegion && provider.ipCountry && "".concat(provider.ipRegion, ", ").concat(provider.ipCountry)}/>
            <LabelValue_1.LabelValue label="Active leases" value={provider.leaseCount}/>
            <LabelValue_1.LabelValue label="Your active leases" value={<div className="flex items-center">
                  {provider.userActiveLeases || 0} {(provider.userActiveLeases || 0) > 0 && <StatusPill_1.StatusPill state="active" size="medium"/>}
                </div>}/>
            <LabelValue_1.LabelValue label="Up time (7d)" value={provider.isOnline && <Uptime_1.Uptime value={provider.uptime7d}/>}/>

            <LabelValue_1.LabelValue label="Favorite" value={<FavoriteButton_1.FavoriteButton isFavorite={isFavorite} onClick={onStarClick}/>}/>
            <LabelValue_1.LabelValue label="Audited" value={provider.isAudited ? (<div className="inline-flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Yes</span>
                    <AuditorButton_1.AuditorButton provider={provider}/>
                  </div>) : (<span className="text-sm text-muted-foreground">No</span>)}/>
          </div>
          {provider.isOnline && (<div className="h-full flex-shrink-0 basis-full lg:basis-2/5">
              <ProviderMap_1.ProviderMap providers={[provider]} initialZoom={5} initialCoordinates={[parseFloat(provider.ipLon), parseFloat(provider.ipLat)]}/>
            </div>)}
        </div>
      </components_1.CardContent>
    </components_1.Card>);
};
exports.ProviderSummary = ProviderSummary;
