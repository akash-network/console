"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryKeys = void 0;
var QueryKeys = /** @class */ (function () {
    function QueryKeys() {
    }
    QueryKeys.getFinancialDataKey = function () { return ["MARKET_DATA"]; };
    QueryKeys.getUsageDataKey = function (address, startDate, endDate) { return ["USAGE_DATA", address, startDate, endDate]; };
    QueryKeys.getUsageStatsDataKey = function (address, startDate, endDate) { return ["USAGE_STATS_DATA", address, startDate, endDate]; };
    QueryKeys.getDashboardDataKey = function () { return ["DASHBOARD_DATA"]; };
    QueryKeys.getBlocksKey = function (limit) { return ["BLOCKS", limit]; };
    QueryKeys.getTransactionsKey = function (limit) { return ["TRANSACTIONS", limit]; };
    QueryKeys.getAddressTransactionsKey = function (address, skip, limit) { return ["ADDRESS_TRANSACTIONS", address, skip, limit]; };
    QueryKeys.getAddressDeploymentsKey = function (address, skip, limit, reverseSorting, filters) { return [
        "ADDRESS_DEPLOYMENTS",
        address,
        skip,
        limit,
        reverseSorting,
        JSON.stringify(filters)
    ]; };
    QueryKeys.getValidatorsKey = function () { return ["VALIDATORS"]; };
    QueryKeys.getProposalsKey = function () { return ["PROPOSALS"]; };
    QueryKeys.getTemplateKey = function (id) { return ["SDL_TEMPLATES", id]; };
    QueryKeys.getUserTemplatesKey = function (username) { return ["USER_TEMPLATES", username]; };
    QueryKeys.getUserFavoriteTemplatesKey = function (userId) { return ["USER_FAVORITES_TEMPLATES", userId]; };
    QueryKeys.getGranterGrants = function (address, page, offset) { return ["GRANTER_GRANTS", address, page, offset]; };
    QueryKeys.getGranteeGrants = function (address) { return ["GRANTEE_GRANTS", address]; };
    QueryKeys.getAllowancesIssued = function (address, page, offset) { return ["ALLOWANCES_ISSUED", address, page, offset]; };
    QueryKeys.getAllowancesGranted = function (address) { return ["ALLOWANCES_GRANTED", address]; };
    // Deploy
    QueryKeys.getDeploymentListKey = function (address) { return ["DEPLOYMENT_LIST", address]; };
    QueryKeys.getDeploymentDetailKey = function (address, dseq) { return ["DEPLOYMENT_DETAIL", address, dseq].filter(Boolean); };
    QueryKeys.getAllLeasesKey = function (address) { return ["ALL_LEASES", address]; };
    QueryKeys.getLeasesKey = function (address, dseq) { return ["LEASE_LIST", address, dseq]; };
    QueryKeys.getLeaseStatusKey = function (dseq, gseq, oseq) { return ["LEASE_STATUS", dseq, gseq, oseq]; };
    QueryKeys.getBidListKey = function (address, dseq) { return ["BID_LIST", address, dseq]; };
    QueryKeys.getBidInfoKey = function (address, dseq, gseq, oseq, provider) { return ["BID_INFO", address, dseq, gseq, oseq, provider]; };
    QueryKeys.getProvidersKey = function () { return ["PROVIDERS"]; };
    QueryKeys.getProviderListKey = function () { return ["PROVIDER_LIST"]; };
    QueryKeys.getProviderRegionsKey = function () { return ["PROVIDER_REGIONS"]; };
    QueryKeys.getProviderDetailKey = function (owner) { return ["PROVIDERS", owner]; };
    QueryKeys.getDataNodeProvidersKey = function () { return ["DATA_NODE_PROVIDERS"]; };
    QueryKeys.getProviderStatusKey = function (providerUri) { return ["PROVIDER_STATUS", providerUri]; };
    QueryKeys.getNetworkCapacity = function () { return ["NETWORK_CAPACITY"]; };
    QueryKeys.getProviderActiveLeasesGraph = function (providerAddress) { return ["PROVIDER_ACTIVE_LEASES_GRAPH", providerAddress]; };
    QueryKeys.getAuditorsKey = function () { return ["AUDITORS"]; };
    QueryKeys.getBlockKey = function (id) { return ["BLOCK", id]; };
    QueryKeys.getBalancesKey = function (address) { return (address ? ["BALANCES", address] : []); };
    QueryKeys.getTemplatesKey = function () { return ["TEMPLATES"]; };
    QueryKeys.getProviderAttributesSchema = function () { return ["PROVIDER_ATTRIBUTES_SCHEMA"]; };
    QueryKeys.getDepositParamsKey = function () { return ["DEPOSIT_PARAMS"]; };
    QueryKeys.getGpuModelsKey = function () { return ["GPU_MODELS"]; };
    QueryKeys.getTrialProvidersKey = function () { return ["TRIAL_PROVIDERS"]; };
    QueryKeys.getDeploymentSettingKey = function (userId, dseq) { return ["DEPLOYMENT_SETTING", userId, dseq]; };
    QueryKeys.getApiKeysKey = function (userId) { return ["API_KEYS", userId]; };
    // Remote deploy
    QueryKeys.getProviderTokenKey = function () { return ["TOKEN"]; };
    QueryKeys.getUserProfileKey = function (accessToken) { return ["USER_PROFILE", accessToken]; };
    QueryKeys.getGroupsKey = function (accessToken) { return ["GROUPS", accessToken]; };
    QueryKeys.getReposByGroupKey = function (group, accessToken) { return ["REPOS_BY_GROUP", group, accessToken]; };
    QueryKeys.getCommitsKey = function (repo, accessToken) { return ["COMMITS", repo, accessToken]; };
    QueryKeys.getCommitsByBranchKey = function (repo, branch, accessToken) { return ["COMMITS_BY_BRANCH", repo, branch, accessToken]; };
    QueryKeys.getWorkspacesKey = function (accessToken) { return ["WORKSPACES", accessToken]; };
    QueryKeys.getReposByWorkspaceKey = function (workspace, accessToken) { return ["REPOS", accessToken, workspace]; };
    QueryKeys.getReposKey = function (accessToken) { return ["REPOS", accessToken]; };
    QueryKeys.getBranchesKey = function (repo, accessToken) { return ["BRANCHES", repo, accessToken]; };
    QueryKeys.getPackageJsonKey = function (repo, branch, subFolder) { return ["PACKAGE_JSON", repo, branch, subFolder]; };
    QueryKeys.getSrcFoldersKey = function (repo, branch) { return ["SRC_FOLDERS", repo, branch]; };
    QueryKeys.getDeploymentGrantsKey = function (granter, grantee) { return ["DEPLOYMENT_GRANT", granter, grantee]; };
    QueryKeys.getFeeAllowancesKey = function (granter, grantee) { return ["FEE_ALLOWANCE", granter, grantee]; };
    QueryKeys.getFeatureFlagsKey = function (networkId) { return ["FEATURE_FLAGS", networkId]; };
    QueryKeys.getPaymentMethodsKey = function () { return ["PAYMENT_METHODS"]; };
    QueryKeys.getManagedWalletKey = function (userId) { return ["MANAGED_WALLET", userId || ""]; };
    QueryKeys.getPaymentTransactionsKey = function (options) {
        var key = ["STRIPE_TRANSACTIONS"];
        if (options === null || options === void 0 ? void 0 : options.limit) {
            key.push("limit", options.limit.toString());
        }
        if (options === null || options === void 0 ? void 0 : options.startingAfter) {
            key.push("after", options.startingAfter);
        }
        if (options === null || options === void 0 ? void 0 : options.endingBefore) {
            key.push("before", options.endingBefore);
        }
        if (options === null || options === void 0 ? void 0 : options.startDate) {
            key.push("start_date", options.startDate.toISOString());
        }
        if (options === null || options === void 0 ? void 0 : options.endDate) {
            key.push("end_date", options.endDate.toISOString());
        }
        return key;
    };
    QueryKeys.getExportTransactionsCsvKey = function (options) {
        var key = ["EXPORT_TRANSACTIONS_CSV", options.timezone];
        if (options.startDate) {
            key.push("start_date", options.startDate.toISOString());
        }
        if (options.endDate) {
            key.push("end_date", options.endDate.toISOString());
        }
        return key;
    };
    return QueryKeys;
}());
exports.QueryKeys = QueryKeys;
