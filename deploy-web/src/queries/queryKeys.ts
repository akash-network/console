export class QueryKeys {
  static getFinancialDataKey = () => ["MARKET_DATA"];
  static getDashboardDataKey = () => ["DASHBOARD_DATA"];
  static getAddressNamesKey = (userId: string) => ["ADDRESS_NAMES", userId];
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
  static getGraphKey = (snapshot: string) => ["GRAPH", snapshot];
  static getProviderGraphKey = (snapshot: string) => ["PROVIDER_GRAPH", snapshot];
  static getTemplateKey = (id: string) => ["SDL_TEMPLATES", id];
  static getUserTemplatesKey = (username: string) => ["USER_TEMPLATES", username];
  static getUserFavoriteTemplatesKey = (userId: string) => ["USER_FAVORITES_TEMPLATES", userId];
  static getGranterGrants = (address: string) => ["GRANTER_GRANTS", address];
  static getGranteeGrants = (address: string) => ["GRANTEE_GRANTS", address];

  // Deploy
  static getDeploymentListKey = address => ["DEPLOYMENT_LIST", address];
  static getDeploymentDetailKey = (address, dseq) => ["DEPLOYMENT_DETAIL", address, dseq];
  static getAllLeasesKey = address => ["ALL_LEASES", address];
  static getLeasesKey = (address, dseq) => ["LEASE_LIST", address, dseq];
  static getLeaseStatusKey = (dseq, gseq, oseq) => ["LEASE_STATUS", dseq, gseq, oseq];
  static getBidListKey = (address, dseq) => ["BID_LIST", address, dseq];
  static getProvidersKey = () => ["PROVIDERS"];
  static getProviderDetailKey = owner => ["PROVIDERS", owner];
  static getDataNodeProvidersKey = () => ["DATA_NODE_PROVIDERS"];
  static getProviderStatusKey = providerUri => ["PROVIDER_STATUS", providerUri];
  static getNetworkCapacity = () => ["NETWORK_CAPACITY"];
  static getProviderActiveLeasesGraph = (providerAddress: string) => ["PROVIDER_ACTIVE_LEASES_GRAPH", providerAddress];
  static getAuditorsKey = () => ["AUDITORS"];
  static getBlockKey = id => ["BLOCK", id];
  static getBalancesKey = (address: string) => ["BALANCES", address];
  static getTemplatesKey = () => ["TEMPLATES"];
  static getProviderAttributesSchema = () => ["PROVIDER_ATTRIBUTES_SCHEMA"];
}
