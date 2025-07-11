import { QueryKeys } from "./queryKeys";

describe("QueryKeys", () => {
  describe("Basic query keys", () => {
    it("should return correct financial data key", () => {
      expect(QueryKeys.getFinancialDataKey()).toEqual(["MARKET_DATA"]);
    });

    it("should return correct dashboard data key", () => {
      expect(QueryKeys.getDashboardDataKey()).toEqual(["DASHBOARD_DATA"]);
    });

    it("should return correct validators key", () => {
      expect(QueryKeys.getValidatorsKey()).toEqual(["VALIDATORS"]);
    });

    it("should return correct proposals key", () => {
      expect(QueryKeys.getProposalsKey()).toEqual(["PROPOSALS"]);
    });

    it("should return correct providers key", () => {
      expect(QueryKeys.getProvidersKey()).toEqual(["PROVIDERS"]);
    });

    it("should return correct provider list key", () => {
      expect(QueryKeys.getProviderListKey()).toEqual(["PROVIDER_LIST"]);
    });

    it("should return correct provider regions key", () => {
      expect(QueryKeys.getProviderRegionsKey()).toEqual(["PROVIDER_REGIONS"]);
    });

    it("should return correct data node providers key", () => {
      expect(QueryKeys.getDataNodeProvidersKey()).toEqual(["DATA_NODE_PROVIDERS"]);
    });

    it("should return correct network capacity key", () => {
      expect(QueryKeys.getNetworkCapacity()).toEqual(["NETWORK_CAPACITY"]);
    });

    it("should return correct auditors key", () => {
      expect(QueryKeys.getAuditorsKey()).toEqual(["AUDITORS"]);
    });

    it("should return correct templates key", () => {
      expect(QueryKeys.getTemplatesKey()).toEqual(["TEMPLATES"]);
    });

    it("should return correct provider attributes schema key", () => {
      expect(QueryKeys.getProviderAttributesSchema()).toEqual(["PROVIDER_ATTRIBUTES_SCHEMA"]);
    });

    it("should return correct deposit params key", () => {
      expect(QueryKeys.getDepositParamsKey()).toEqual(["DEPOSIT_PARAMS"]);
    });

    it("should return correct GPU models key", () => {
      expect(QueryKeys.getGpuModelsKey()).toEqual(["GPU_MODELS"]);
    });

    it("should return correct trial providers key", () => {
      expect(QueryKeys.getTrialProvidersKey()).toEqual(["TRIAL_PROVIDERS"]);
    });

    it("should return correct provider token key", () => {
      expect(QueryKeys.getProviderTokenKey()).toEqual(["TOKEN"]);
    });

    it("should return correct payment methods key", () => {
      expect(QueryKeys.getPaymentMethodsKey()).toEqual(["PAYMENT_METHODS"]);
    });

    it("should return correct payment discounts key", () => {
      expect(QueryKeys.getPaymentDiscountsKey()).toEqual(["PAYMENT_DISCOUNTS"]);
    });
  });

  describe("Parameterized query keys", () => {
    it("should return correct blocks key with limit", () => {
      expect(QueryKeys.getBlocksKey(10)).toEqual(["BLOCKS", 10]);
      expect(QueryKeys.getBlocksKey(50)).toEqual(["BLOCKS", 50]);
    });

    it("should return correct transactions key with limit", () => {
      expect(QueryKeys.getTransactionsKey(25)).toEqual(["TRANSACTIONS", 25]);
      expect(QueryKeys.getTransactionsKey(100)).toEqual(["TRANSACTIONS", 100]);
    });

    it("should return correct template key with id", () => {
      expect(QueryKeys.getTemplateKey("template-123")).toEqual(["SDL_TEMPLATES", "template-123"]);
      expect(QueryKeys.getTemplateKey("another-template")).toEqual(["SDL_TEMPLATES", "another-template"]);
    });

    it("should return correct user templates key", () => {
      expect(QueryKeys.getUserTemplatesKey("john_doe")).toEqual(["USER_TEMPLATES", "john_doe"]);
      expect(QueryKeys.getUserTemplatesKey("jane_smith")).toEqual(["USER_TEMPLATES", "jane_smith"]);
    });

    it("should return correct user favorite templates key", () => {
      expect(QueryKeys.getUserFavoriteTemplatesKey("user-123")).toEqual(["USER_FAVORITES_TEMPLATES", "user-123"]);
      expect(QueryKeys.getUserFavoriteTemplatesKey("user-456")).toEqual(["USER_FAVORITES_TEMPLATES", "user-456"]);
    });

    it("should return correct provider detail key", () => {
      expect(QueryKeys.getProviderDetailKey("provider-owner")).toEqual(["PROVIDERS", "provider-owner"]);
      expect(QueryKeys.getProviderDetailKey("another-owner")).toEqual(["PROVIDERS", "another-owner"]);
    });

    it("should return correct provider status key", () => {
      expect(QueryKeys.getProviderStatusKey("https://provider.com")).toEqual(["PROVIDER_STATUS", "https://provider.com"]);
      expect(QueryKeys.getProviderStatusKey("https://another-provider.com")).toEqual(["PROVIDER_STATUS", "https://another-provider.com"]);
    });

    it("should return correct provider active leases graph key", () => {
      expect(QueryKeys.getProviderActiveLeasesGraph("provider-address")).toEqual(["PROVIDER_ACTIVE_LEASES_GRAPH", "provider-address"]);
      expect(QueryKeys.getProviderActiveLeasesGraph("another-address")).toEqual(["PROVIDER_ACTIVE_LEASES_GRAPH", "another-address"]);
    });

    it("should return correct block key with id", () => {
      expect(QueryKeys.getBlockKey("block-123")).toEqual(["BLOCK", "block-123"]);
      expect(QueryKeys.getBlockKey("block-456")).toEqual(["BLOCK", "block-456"]);
    });

    it("should return correct feature flags key", () => {
      expect(QueryKeys.getFeatureFlagsKey("mainnet")).toEqual(["FEATURE_FLAGS", "mainnet"]);
      expect(QueryKeys.getFeatureFlagsKey("testnet")).toEqual(["FEATURE_FLAGS", "testnet"]);
    });
  });

  describe("Address-based query keys", () => {
    it("should return correct address transactions key", () => {
      expect(QueryKeys.getAddressTransactionsKey("address-123", 0, 10)).toEqual(["ADDRESS_TRANSACTIONS", "address-123", 0, 10]);
      expect(QueryKeys.getAddressTransactionsKey("address-456", 20, 50)).toEqual(["ADDRESS_TRANSACTIONS", "address-456", 20, 50]);
    });

    it("should return correct address deployments key", () => {
      const filters = { status: "active", type: "web" };
      expect(QueryKeys.getAddressDeploymentsKey("address-123", 0, 10, false, filters)).toEqual([
        "ADDRESS_DEPLOYMENTS",
        "address-123",
        0,
        10,
        false,
        JSON.stringify(filters)
      ]);

      const emptyFilters = {};
      expect(QueryKeys.getAddressDeploymentsKey("address-456", 20, 50, true, emptyFilters)).toEqual([
        "ADDRESS_DEPLOYMENTS",
        "address-456",
        20,
        50,
        true,
        JSON.stringify(emptyFilters)
      ]);
    });

    it("should return correct granter grants key", () => {
      expect(QueryKeys.getGranterGrants("granter-address", 1, 10)).toEqual(["GRANTER_GRANTS", "granter-address", 1, 10]);
      expect(QueryKeys.getGranterGrants("another-granter", 2, 20)).toEqual(["GRANTER_GRANTS", "another-granter", 2, 20]);
    });

    it("should return correct grantee grants key", () => {
      expect(QueryKeys.getGranteeGrants("grantee-address")).toEqual(["GRANTEE_GRANTS", "grantee-address"]);
      expect(QueryKeys.getGranteeGrants("another-grantee")).toEqual(["GRANTEE_GRANTS", "another-grantee"]);
    });

    it("should return correct allowances issued key", () => {
      expect(QueryKeys.getAllowancesIssued("address-123", 1, 10)).toEqual(["ALLOWANCES_ISSUED", "address-123", 1, 10]);
      expect(QueryKeys.getAllowancesIssued("address-456", 2, 20)).toEqual(["ALLOWANCES_ISSUED", "address-456", 2, 20]);
    });

    it("should return correct allowances granted key", () => {
      expect(QueryKeys.getAllowancesGranted("address-123")).toEqual(["ALLOWANCES_GRANTED", "address-123"]);
      expect(QueryKeys.getAllowancesGranted("address-456")).toEqual(["ALLOWANCES_GRANTED", "address-456"]);
    });

    it("should return correct balances key", () => {
      expect(QueryKeys.getBalancesKey("address-123")).toEqual(["BALANCES", "address-123"]);
      expect(QueryKeys.getBalancesKey("address-456")).toEqual(["BALANCES", "address-456"]);
      expect(QueryKeys.getBalancesKey()).toEqual([]);
      expect(QueryKeys.getBalancesKey(undefined)).toEqual([]);
    });
  });

  describe("Deployment-related query keys", () => {
    it("should return correct deployment list key", () => {
      expect(QueryKeys.getDeploymentListKey("deployer-address")).toEqual(["DEPLOYMENT_LIST", "deployer-address"]);
      expect(QueryKeys.getDeploymentListKey("another-deployer")).toEqual(["DEPLOYMENT_LIST", "another-deployer"]);
    });

    it("should return correct deployment detail key", () => {
      expect(QueryKeys.getDeploymentDetailKey("deployer-address", "dseq-123")).toEqual(["DEPLOYMENT_DETAIL", "deployer-address", "dseq-123"]);
      expect(QueryKeys.getDeploymentDetailKey("another-deployer", "dseq-456")).toEqual(["DEPLOYMENT_DETAIL", "another-deployer", "dseq-456"]);
    });

    it("should return correct all leases key", () => {
      expect(QueryKeys.getAllLeasesKey("address-123")).toEqual(["ALL_LEASES", "address-123"]);
      expect(QueryKeys.getAllLeasesKey("address-456")).toEqual(["ALL_LEASES", "address-456"]);
    });

    it("should return correct leases key", () => {
      expect(QueryKeys.getLeasesKey("address-123", "dseq-123")).toEqual(["LEASE_LIST", "address-123", "dseq-123"]);
      expect(QueryKeys.getLeasesKey("address-456", "dseq-456")).toEqual(["LEASE_LIST", "address-456", "dseq-456"]);
    });

    it("should return correct lease status key", () => {
      expect(QueryKeys.getLeaseStatusKey("dseq-123", 1, 1)).toEqual(["LEASE_STATUS", "dseq-123", 1, 1]);
      expect(QueryKeys.getLeaseStatusKey("dseq-456", 2, 3)).toEqual(["LEASE_STATUS", "dseq-456", 2, 3]);
    });

    it("should return correct bid list key", () => {
      expect(QueryKeys.getBidListKey("address-123", "dseq-123")).toEqual(["BID_LIST", "address-123", "dseq-123"]);
      expect(QueryKeys.getBidListKey("address-456", "dseq-456")).toEqual(["BID_LIST", "address-456", "dseq-456"]);
    });

    it("should return correct bid info key", () => {
      expect(QueryKeys.getBidInfoKey("address-123", "dseq-123", 1, 1, "provider-123")).toEqual(["BID_INFO", "address-123", "dseq-123", 1, 1, "provider-123"]);
      expect(QueryKeys.getBidInfoKey("address-456", "dseq-456", 2, 3, "provider-456")).toEqual(["BID_INFO", "address-456", "dseq-456", 2, 3, "provider-456"]);
    });

    it("should return correct deployment setting key", () => {
      expect(QueryKeys.getDeploymentSettingKey("user-123", "dseq-123")).toEqual(["DEPLOYMENT_SETTING", "user-123", "dseq-123"]);
      expect(QueryKeys.getDeploymentSettingKey("user-456", "dseq-456")).toEqual(["DEPLOYMENT_SETTING", "user-456", "dseq-456"]);
    });

    it("should return correct deployment grants key", () => {
      expect(QueryKeys.getDeploymentGrantsKey("granter-123", "grantee-123")).toEqual(["DEPLOYMENT_GRANT", "granter-123", "grantee-123"]);
      expect(QueryKeys.getDeploymentGrantsKey("granter-456", "grantee-456")).toEqual(["DEPLOYMENT_GRANT", "granter-456", "grantee-456"]);
    });

    it("should return correct fee allowances key", () => {
      expect(QueryKeys.getFeeAllowancesKey("granter-123", "grantee-123")).toEqual(["FEE_ALLOWANCE", "granter-123", "grantee-123"]);
      expect(QueryKeys.getFeeAllowancesKey("granter-456", "grantee-456")).toEqual(["FEE_ALLOWANCE", "granter-456", "grantee-456"]);
    });

    it("should return correct API keys key", () => {
      expect(QueryKeys.getApiKeysKey("user-123")).toEqual(["API_KEYS", "user-123"]);
      expect(QueryKeys.getApiKeysKey("user-456")).toEqual(["API_KEYS", "user-456"]);
    });
  });

  describe("Remote deploy query keys", () => {
    it("should return correct user profile key", () => {
      expect(QueryKeys.getUserProfileKey("token-123")).toEqual(["USER_PROFILE", "token-123"]);
      expect(QueryKeys.getUserProfileKey("token-456")).toEqual(["USER_PROFILE", "token-456"]);
      expect(QueryKeys.getUserProfileKey()).toEqual(["USER_PROFILE", undefined]);
      expect(QueryKeys.getUserProfileKey(null)).toEqual(["USER_PROFILE", null]);
    });

    it("should return correct groups key", () => {
      expect(QueryKeys.getGroupsKey("token-123")).toEqual(["GROUPS", "token-123"]);
      expect(QueryKeys.getGroupsKey("token-456")).toEqual(["GROUPS", "token-456"]);
      expect(QueryKeys.getGroupsKey()).toEqual(["GROUPS", undefined]);
      expect(QueryKeys.getGroupsKey(null)).toEqual(["GROUPS", null]);
    });

    it("should return correct repos by group key", () => {
      expect(QueryKeys.getReposByGroupKey("group-123", "token-123")).toEqual(["REPOS_BY_GROUP", "group-123", "token-123"]);
      expect(QueryKeys.getReposByGroupKey("group-456", "token-456")).toEqual(["REPOS_BY_GROUP", "group-456", "token-456"]);
      expect(QueryKeys.getReposByGroupKey()).toEqual(["REPOS_BY_GROUP", undefined, undefined]);
      expect(QueryKeys.getReposByGroupKey("group-123")).toEqual(["REPOS_BY_GROUP", "group-123", undefined]);
    });

    it("should return correct commits key", () => {
      expect(QueryKeys.getCommitsKey("repo-123", "token-123")).toEqual(["COMMITS", "repo-123", "token-123"]);
      expect(QueryKeys.getCommitsKey("repo-456", "token-456")).toEqual(["COMMITS", "repo-456", "token-456"]);
      expect(QueryKeys.getCommitsKey()).toEqual(["COMMITS", undefined, undefined]);
      expect(QueryKeys.getCommitsKey("repo-123")).toEqual(["COMMITS", "repo-123", undefined]);
    });

    it("should return correct commits by branch key", () => {
      expect(QueryKeys.getCommitsByBranchKey("repo-123", "main", "token-123")).toEqual(["COMMITS_BY_BRANCH", "repo-123", "main", "token-123"]);
      expect(QueryKeys.getCommitsByBranchKey("repo-456", "develop", "token-456")).toEqual(["COMMITS_BY_BRANCH", "repo-456", "develop", "token-456"]);
      expect(QueryKeys.getCommitsByBranchKey()).toEqual(["COMMITS_BY_BRANCH", undefined, undefined, undefined]);
      expect(QueryKeys.getCommitsByBranchKey("repo-123", "main")).toEqual(["COMMITS_BY_BRANCH", "repo-123", "main", undefined]);
    });

    it("should return correct workspaces key", () => {
      expect(QueryKeys.getWorkspacesKey("token-123")).toEqual(["WORKSPACES", "token-123"]);
      expect(QueryKeys.getWorkspacesKey("token-456")).toEqual(["WORKSPACES", "token-456"]);
      expect(QueryKeys.getWorkspacesKey()).toEqual(["WORKSPACES", undefined]);
      expect(QueryKeys.getWorkspacesKey(null)).toEqual(["WORKSPACES", null]);
    });

    it("should return correct repos by workspace key", () => {
      expect(QueryKeys.getReposByWorkspaceKey("workspace-123", "token-123")).toEqual(["REPOS", "token-123", "workspace-123"]);
      expect(QueryKeys.getReposByWorkspaceKey("workspace-456", "token-456")).toEqual(["REPOS", "token-456", "workspace-456"]);
      expect(QueryKeys.getReposByWorkspaceKey("workspace-123", null)).toEqual(["REPOS", null, "workspace-123"]);
    });

    it("should return correct repos key", () => {
      expect(QueryKeys.getReposKey("token-123")).toEqual(["REPOS", "token-123"]);
      expect(QueryKeys.getReposKey("token-456")).toEqual(["REPOS", "token-456"]);
      expect(QueryKeys.getReposKey()).toEqual(["REPOS", undefined]);
      expect(QueryKeys.getReposKey(null)).toEqual(["REPOS", null]);
    });

    it("should return correct branches key", () => {
      expect(QueryKeys.getBranchesKey("repo-123", "token-123")).toEqual(["BRANCHES", "repo-123", "token-123"]);
      expect(QueryKeys.getBranchesKey("repo-456", "token-456")).toEqual(["BRANCHES", "repo-456", "token-456"]);
      expect(QueryKeys.getBranchesKey()).toEqual(["BRANCHES", undefined, undefined]);
      expect(QueryKeys.getBranchesKey("repo-123")).toEqual(["BRANCHES", "repo-123", undefined]);
    });

    it("should return correct package json key", () => {
      expect(QueryKeys.getPackageJsonKey("repo-123", "main", "src")).toEqual(["PACKAGE_JSON", "repo-123", "main", "src"]);
      expect(QueryKeys.getPackageJsonKey("repo-456", "develop", "app")).toEqual(["PACKAGE_JSON", "repo-456", "develop", "app"]);
      expect(QueryKeys.getPackageJsonKey()).toEqual(["PACKAGE_JSON", undefined, undefined, undefined]);
      expect(QueryKeys.getPackageJsonKey("repo-123", "main")).toEqual(["PACKAGE_JSON", "repo-123", "main", undefined]);
    });

    it("should return correct src folders key", () => {
      expect(QueryKeys.getSrcFoldersKey("repo-123", "main")).toEqual(["SRC_FOLDERS", "repo-123", "main"]);
      expect(QueryKeys.getSrcFoldersKey("repo-456", "develop")).toEqual(["SRC_FOLDERS", "repo-456", "develop"]);
      expect(QueryKeys.getSrcFoldersKey()).toEqual(["SRC_FOLDERS", undefined, undefined]);
      expect(QueryKeys.getSrcFoldersKey("repo-123")).toEqual(["SRC_FOLDERS", "repo-123", undefined]);
    });
  });

  describe("Payment transactions query key", () => {
    it("should return basic payment transactions key with no options", () => {
      expect(QueryKeys.getPaymentTransactionsKey()).toEqual(["STRIPE_TRANSACTIONS"]);
    });

    it("should return payment transactions key with limit", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ limit: 10 })).toEqual(["STRIPE_TRANSACTIONS", "limit", "10"]);
      expect(QueryKeys.getPaymentTransactionsKey({ limit: 50 })).toEqual(["STRIPE_TRANSACTIONS", "limit", "50"]);
    });

    it("should return payment transactions key with startingAfter", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ startingAfter: "txn_123" })).toEqual(["STRIPE_TRANSACTIONS", "after", "txn_123"]);
      expect(QueryKeys.getPaymentTransactionsKey({ startingAfter: "txn_456" })).toEqual(["STRIPE_TRANSACTIONS", "after", "txn_456"]);
    });

    it("should return payment transactions key with endingBefore", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ endingBefore: "txn_123" })).toEqual(["STRIPE_TRANSACTIONS", "before", "txn_123"]);
      expect(QueryKeys.getPaymentTransactionsKey({ endingBefore: "txn_456" })).toEqual(["STRIPE_TRANSACTIONS", "before", "txn_456"]);
    });

    it("should return payment transactions key with created start_date", () => {
      const startDate = new Date();
      expect(QueryKeys.getPaymentTransactionsKey({ startDate })).toEqual(["STRIPE_TRANSACTIONS", "start_date", startDate.toISOString()]);
    });

    it("should return payment transactions key with created end_date", () => {
      const endDate = new Date();
      expect(QueryKeys.getPaymentTransactionsKey({ endDate })).toEqual(["STRIPE_TRANSACTIONS", "end_date", endDate.toISOString()]);
    });

    it("should return payment transactions key with created start_date and end_date", () => {
      const startDate = new Date(1234567890);
      const endDate = new Date(1234567900);
      expect(QueryKeys.getPaymentTransactionsKey({ startDate, endDate })).toEqual([
        "STRIPE_TRANSACTIONS",
        "start_date",
        startDate.toISOString(),
        "end_date",
        endDate.toISOString()
      ]);
    });

    it("should return payment transactions key with multiple options", () => {
      const startDate = new Date(1234567890);
      const endDate = new Date(1234567900);
      expect(
        QueryKeys.getPaymentTransactionsKey({
          limit: 25,
          startingAfter: "txn_123",
          endingBefore: "txn_456",
          startDate,
          endDate
        })
      ).toEqual([
        "STRIPE_TRANSACTIONS",
        "limit",
        "25",
        "after",
        "txn_123",
        "before",
        "txn_456",
        "start_date",
        startDate.toISOString(),
        "end_date",
        endDate.toISOString()
      ]);
    });

    it("should handle null values for startingAfter and endingBefore", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ startingAfter: null })).toEqual(["STRIPE_TRANSACTIONS"]);
      expect(QueryKeys.getPaymentTransactionsKey({ endingBefore: null })).toEqual(["STRIPE_TRANSACTIONS"]);
    });

    it("should handle partial created options", () => {
      expect(QueryKeys.getPaymentTransactionsKey()).toEqual(["STRIPE_TRANSACTIONS"]);
      const startDate = new Date(1234567890);
      expect(QueryKeys.getPaymentTransactionsKey({ startDate })).toEqual(["STRIPE_TRANSACTIONS", "start_date", startDate.toISOString()]);
      const endDate = new Date(1234567900);
      expect(QueryKeys.getPaymentTransactionsKey({ endDate })).toEqual(["STRIPE_TRANSACTIONS", "end_date", endDate.toISOString()]);
    });
  });

  describe("Edge cases and type validation", () => {
    it("should handle empty strings", () => {
      expect(QueryKeys.getTemplateKey("")).toEqual(["SDL_TEMPLATES", ""]);
      expect(QueryKeys.getUserTemplatesKey("")).toEqual(["USER_TEMPLATES", ""]);
      expect(QueryKeys.getBlockKey("")).toEqual(["BLOCK", ""]);
    });

    it("should handle special characters in strings", () => {
      expect(QueryKeys.getTemplateKey("template-with-special-chars!@#$%")).toEqual(["SDL_TEMPLATES", "template-with-special-chars!@#$%"]);
      expect(QueryKeys.getUserTemplatesKey("user@domain.com")).toEqual(["USER_TEMPLATES", "user@domain.com"]);
    });

    it("should handle zero values", () => {
      expect(QueryKeys.getBlocksKey(0)).toEqual(["BLOCKS", 0]);
      expect(QueryKeys.getTransactionsKey(0)).toEqual(["TRANSACTIONS", 0]);
      expect(QueryKeys.getAddressTransactionsKey("address", 0, 0)).toEqual(["ADDRESS_TRANSACTIONS", "address", 0, 0]);
    });

    it("should handle negative values", () => {
      expect(QueryKeys.getBlocksKey(-1)).toEqual(["BLOCKS", -1]);
      expect(QueryKeys.getTransactionsKey(-10)).toEqual(["TRANSACTIONS", -10]);
      expect(QueryKeys.getAddressTransactionsKey("address", -5, -10)).toEqual(["ADDRESS_TRANSACTIONS", "address", -5, -10]);
    });

    it("should handle large numbers", () => {
      const largeNumber = 999999999999;
      expect(QueryKeys.getBlocksKey(largeNumber)).toEqual(["BLOCKS", largeNumber]);
      expect(QueryKeys.getTransactionsKey(largeNumber)).toEqual(["TRANSACTIONS", largeNumber]);
    });
  });
});
