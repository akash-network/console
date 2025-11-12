"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditProviderContainer = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var providerUtils_1 = require("@src/utils/providerUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var EditProviderForm_1 = require("./EditProviderForm");
var EditProviderContainer = function (_a) {
    var owner = _a.owner;
    var _b = (0, useProvidersQuery_1.useProviderDetail)(owner, { enabled: false }), provider = _b.data, isLoadingProvider = _b.isLoading, getProviderDetail = _b.refetch;
    var _c = (0, useProvidersQuery_1.useProviderAttributesSchema)(), providerAttributesSchema = _c.data, isLoadingSchema = _c.isFetching;
    (0, react_1.useEffect)(function () {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    var refresh = function () {
        getProviderDetail();
    };
    return (<Layout_1.default isLoading={isLoadingSchema || isLoadingProvider}>
      <next_seo_1.NextSeo title={"Edit Provider ".concat(owner)}/>

      {provider && providerAttributesSchema && (<>
          <div className="flex items-center">
            <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "ghost" }), "flex items-center")} href={urlUtils_1.UrlService.providerDetail(provider.owner)} replace>
              <iconoir_react_1.NavArrowLeft />
              Back
            </link_1.default>

            <h1 className="ml-6 text-2xl">
              Edit Provider <strong>{(0, providerUtils_1.getProviderNameFromUri)(provider.hostUri)}</strong>
            </h1>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              This form is based on the provider attribute schema established here&nbsp;
              <a target="_blank" href="https://github.com/akash-network/console/blob/main/config/provider-attributes.json" rel="noreferrer noopener">
                on github.
              </a>
            </p>
          </div>

          <div className="py-4">
            <EditProviderForm_1.EditProviderForm provider={provider} providerAttributesSchema={providerAttributesSchema}/>
          </div>
        </>)}

      {(isLoadingSchema || isLoadingProvider) && (<div className="flex items-center justify-center p-8">
          <components_1.Spinner size="large"/>
        </div>)}
    </Layout_1.default>);
};
exports.EditProviderContainer = EditProviderContainer;
