"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ApiKeysPage;
var react_1 = require("react");
var next_seo_1 = require("next-seo");
var notistack_1 = require("notistack");
var ApiKeyList_1 = require("@src/components/api-keys/ApiKeyList");
var Layout_1 = require("@src/components/layout/Layout");
var RequiredUserContainer_1 = require("@src/components/user/RequiredUserContainer");
var useApiKeysQuery_1 = require("@src/queries/useApiKeysQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
function ApiKeysPage() {
    var _a;
    var _b = (0, react_1.useState)(null), apiKeyToDelete = _b[0], setApiKeyToDelete = _b[1];
    var _c = (0, useApiKeysQuery_1.useUserApiKeys)(), apiKeys = _c.data, isLoadingApiKeys = _c.isLoading;
    var _d = (0, useApiKeysQuery_1.useDeleteApiKey)((_a = apiKeyToDelete === null || apiKeyToDelete === void 0 ? void 0 : apiKeyToDelete.id) !== null && _a !== void 0 ? _a : "", function () {
        setApiKeyToDelete(null);
        (0, notistack_1.enqueueSnackbar)("API Key deleted successfully", {
            variant: "success"
        });
    }), deleteApiKey = _d.mutate, isDeleting = _d.isPending;
    var isLoading = isLoadingApiKeys || isDeleting;
    var onDeleteApiKey = function () {
        deleteApiKey();
        analytics_service_1.analyticsService.track("delete_api_key", {
            category: "settings",
            label: "Delete API key"
        });
    };
    var onDeleteClose = function () {
        setApiKeyToDelete(null);
    };
    return (<RequiredUserContainer_1.RequiredUserContainer>
      <Layout_1.default isLoading={isLoading}>
        <next_seo_1.NextSeo title="API Keys"/>

        <ApiKeyList_1.ApiKeyList apiKeys={apiKeys} onDeleteApiKey={onDeleteApiKey} onDeleteClose={onDeleteClose} isDeleting={isDeleting} apiKeyToDelete={apiKeyToDelete} updateApiKeyToDelete={function (apiKey) { return setApiKeyToDelete(apiKey); }}/>
      </Layout_1.default>
    </RequiredUserContainer_1.RequiredUserContainer>);
}
