"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseChip = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var CopyTextToClipboardButton_1 = require("../shared/CopyTextToClipboardButton");
var ShortenedValue_1 = require("../shared/ShortenedValue");
var StatusPill_1 = require("../shared/StatusPill");
var LeaseChip = function (_a) {
    var lease = _a.lease, providers = _a.providers;
    var _b = (0, react_1.useState)(""), providerName = _b[0], setProviderName = _b[1];
    (0, react_1.useEffect)(function () {
        var _a;
        var provider = providers === null || providers === void 0 ? void 0 : providers.find(function (p) { return p.owner === (lease === null || lease === void 0 ? void 0 : lease.provider); });
        if (provider) {
            setProviderName((_a = provider.name) !== null && _a !== void 0 ? _a : "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providers]);
    return (<div className="flex items-center space-x-2">
      <link_1.default href={urlUtils_1.UrlService.providerDetail(lease.provider)} onClick={function (event) {
            event.stopPropagation();
        }}>
        <components_1.Badge variant="outline" className="whitespace-nowrap text-xs hover:bg-primary/20">
          {providerName ? <ShortenedValue_1.ShortenedValue value={providerName} maxLength={40} headLength={14}/> : <components_1.Spinner size="xSmall"/>}
          <StatusPill_1.StatusPill state={lease.state} size="small"/>
        </components_1.Badge>
      </link_1.default>

      {providerName && <CopyTextToClipboardButton_1.CopyTextToClipboardButton value={providerName}/>}
    </div>);
};
exports.LeaseChip = LeaseChip;
