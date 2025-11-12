"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderName = void 0;
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var ShortenedValue_1 = require("./ShortenedValue");
var ProviderName = function (_a) {
    var provider = _a.provider;
    return provider.name ? (<link_1.default href={urlUtils_1.UrlService.providerDetail(provider.owner)} onClick={function (e) { return e.stopPropagation(); }}>
      <ShortenedValue_1.ShortenedValue value={provider.name} maxLength={40} headLength={14}/>
    </link_1.default>) : (<ShortenedValue_1.ShortenedValue value={provider.hostUri} maxLength={40} headLength={14}/>);
};
exports.ProviderName = ProviderName;
