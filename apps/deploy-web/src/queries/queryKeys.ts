export class QueryKeys {
  static getFinancialDataKey = () => ["MARKET_DATA"];
  static getUsageDataKey = (address: string, startDate?: string, endDate?: string) => ["USAGE_DATA", address, startDate, endDate];
  static getUsageStatsDataKey = (address: string, startDate?: string, endDate?: string) => ["USAGE_STATS_DATA", address, startDate, endDate];
  static getDashboardDataKey = () => ["DASHBOARD_DATA"];
  static getBlocksKey = (limit: number) => ["BLOCKS", limit];
  static getTransactionsKey = (limit: number) => ["TRANSACTIONS", limit];
  static getAddressTransactionsKey = (address: string, skip: number, limit: number) => ["ADDRESS_TRANSACTIONS", address, skip, limit];
  static getAddressDeploymentsKey = (address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) => [
    "ADDRESS_DEPLOYMENTS",
    address,
    skip,
    limit,
    reverseSorting,
    JSON.stringify(filters)
  ];
  static getValidatorsKey = () => ["VALIDATORS"];
  static getProposalsKey = () => ["PROPOSALS"];
  static getTemplateKey = (id: string) => ["SDL_TEMPLATES", id];
  static getUserTemplatesKey = (username: string) => ["USER_TEMPLATES", username];
  static getUserFavoriteTemplatesKey = (userId: string) => ["USER_FAVORITES_TEMPLATES", userId];
  static getGranterGrants = (address: string, page: number, offset: number) => ["GRANTER_GRANTS", address, page, offset];
  static getGranteeGrants = (address: string) => ["GRANTEE_GRANTS", address];
  static getAllowancesIssued = (address: string, page: number, offset: number) => ["ALLOWANCES_ISSUED", address, page, offset];
  static getAllowancesGranted = (address: string) => ["ALLOWANCES_GRANTED", address];

  // Deploy
  static getDeploymentListKey = (address: string) => ["DEPLOYMENT_LIST", address];
  static getDeploymentDetailKey = (address: string, dseq?: string) => ["DEPLOYMENT_DETAIL", address, dseq].filter(Boolean);
  static getAllLeasesKey = (address: string) => ["ALL_LEASES", address];
  static getLeasesKey = (address: string, dseq: string) => ["LEASE_LIST", address, dseq];
  static getLeaseStatusKey = (dseq: string, gseq: number, oseq: number) => ["LEASE_STATUS", dseq, gseq, oseq];
  static getBidListKey = (address: string, dseq: string) => ["BID_LIST", address, dseq];
  static getBidInfoKey = (address: string, dseq: string, gseq: number, oseq: number, provider: string) => ["BID_INFO", address, dseq, gseq, oseq, provider];
  static getProvidersKey = () => ["PROVIDERS"];
  static getProviderListKey = () => ["PROVIDER_LIST"];
  static getProviderRegionsKey = () => ["PROVIDER_REGIONS"];
  static getProviderDetailKey = (owner: string) => ["PROVIDERS", owner];
  static getDataNodeProvidersKey = () => ["DATA_NODE_PROVIDERS"];
  static getProviderStatusKey = (providerUri: string) => ["PROVIDER_STATUS", providerUri];
  static getNetworkCapacity = () => ["NETWORK_CAPACITY"];
  static getProviderActiveLeasesGraph = (providerAddress: string) => ["PROVIDER_ACTIVE_LEASES_GRAPH", providerAddress];
  static getAuditorsKey = () => ["AUDITORS"];
  static getBlockKey = (id: string) => ["BLOCK", id];
  static getBalancesKey = (address?: string) => (address ? ["BALANCES", address] : []);
  static getTemplatesKey = () => ["TEMPLATES"];
  static getProviderAttributesSchema = () => ["PROVIDER_ATTRIBUTES_SCHEMA"];
  static getDepositParamsKey = () => ["DEPOSIT_PARAMS"];
  static getGpuModelsKey = () => ["GPU_MODELS"];
  static getTrialProvidersKey = () => ["TRIAL_PROVIDERS"];
  static getDeploymentSettingKey = (userId: string, dseq: string) => ["DEPLOYMENT_SETTING", userId, dseq];
  static getApiKeysKey = (userId: string) => ["API_KEYS", userId];

  // Remote deploy
  static getProviderTokenKey = () => ["TOKEN"];
  static getUserProfileKey = (accessToken?: string | null) => ["USER_PROFILE", accessToken];
  static getGroupsKey = (accessToken?: string | null) => ["GROUPS", accessToken];
  static getReposByGroupKey = (group?: string, accessToken?: string | null) => ["REPOS_BY_GROUP", group, accessToken];
  static getCommitsKey = (repo?: string, accessToken?: string | null) => ["COMMITS", repo, accessToken];
  static getCommitsByBranchKey = (repo?: string, branch?: string, accessToken?: string | null) => ["COMMITS_BY_BRANCH", repo, branch, accessToken];
  static getWorkspacesKey = (accessToken?: string | null) => ["WORKSPACES", accessToken];
  static getReposByWorkspaceKey = (workspace: string, accessToken: string | null) => ["REPOS", accessToken, workspace];
  static getReposKey = (accessToken?: string | null) => ["REPOS", accessToken];
  static getBranchesKey = (repo?: string, accessToken?: string | null) => ["BRANCHES", repo, accessToken];
  static getPackageJsonKey = (repo?: string, branch?: string, subFolder?: string) => ["PACKAGE_JSON", repo, branch, subFolder];
  static getSrcFoldersKey = (repo?: string, branch?: string) => ["SRC_FOLDERS", repo, branch];

  static getDeploymentGrantsKey = (granter: string, grantee: string) => ["DEPLOYMENT_GRANT", granter, grantee];
  static getFeeAllowancesKey = (granter: string, grantee: string) => ["FEE_ALLOWANCE", granter, grantee];

  static getFeatureFlagsKey = (networkId: string) => ["FEATURE_FLAGS", networkId];

  static getPaymentMethodsKey = () => ["PAYMENT_METHODS"];
  static getPaymentDiscountsKey = () => ["PAYMENT_DISCOUNTS"];

  static getManagedWalletKey = (userId?: string) => ["MANAGED_WALLET", userId || ""];

  static getPaymentTransactionsKey = (options?: {
    limit?: number;
    startingAfter?: string | null;
    endingBefore?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  }) => {
    const key = ["STRIPE_TRANSACTIONS"];

    if (options?.limit) {
      key.push("limit", options.limit.toString());
    }

    if (options?.startingAfter) {
      key.push("after", options.startingAfter);
    }

    if (options?.endingBefore) {
      key.push("before", options.endingBefore);
    }

    if (options?.startDate) {
      key.push("start_date", options.startDate.toISOString());
    }

    if (options?.endDate) {
      key.push("end_date", options.endDate.toISOString());
    }

    return key;
  };

  static getExportTransactionsCsvKey = (options: { startDate?: Date | null; endDate?: Date | null; timezone: string }) => {
    const key = ["EXPORT_TRANSACTIONS_CSV", options.timezone];

    if (options.startDate) {
      key.push("start_date", options.startDate.toISOString());
    }

    if (options.endDate) {
      key.push("end_date", options.endDate.toISOString());
    }

    return key;
  };
}
