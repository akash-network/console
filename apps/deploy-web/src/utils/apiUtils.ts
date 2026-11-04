import { services } from "@src/services/app-di-container/browser-di-container";
import networkStore from "@src/store/networkStore";
import { appendSearchParams } from "./urlUtils";

export class ApiUrlService {
  static providerSearch() {
    return `${this.baseApiUrl}/v1/provider-search`;
  }
  static providerLocations() {
    return `${this.baseApiUrl}/v1/provider-locations`;
  }
  static providerDetail(owner: string) {
    return `${this.baseApiUrl}/v1/providers/${owner}`;
  }
  static providerRegions() {
    return `${this.baseApiUrl}/v1/provider-regions`;
  }
  static dashboardData() {
    return `${this.baseApiUrl}/v1/dashboard-data`;
  }
  static marketData() {
    return `${this.baseApiUrl}/v1/market-data`;
  }
  static proposals() {
    return `${this.baseApiUrl}/v1/proposals`;
  }
  static templates() {
    return `${this.baseApiUrl}/v1/templates`;
  }
  static usage() {
    return `${this.baseApiUrl}/v1/usage/history`;
  }
  static usageStats() {
    return `${this.baseApiUrl}/v1/usage/history/stats`;
  }
  static validators() {
    return `${this.baseApiUrl}/v1/validators`;
  }
  static transactions(limit: number) {
    return `${this.baseApiUrl}/v1/transactions${appendSearchParams({ limit })}`;
  }
  static addressTransactions(address: string, skip: number, limit: number) {
    return `${this.baseApiUrl}/v1/addresses/${address}/transactions/${skip}/${limit}`;
  }
  static addressDeployments(address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) {
    return `${this.baseApiUrl}/v1/addresses/${address}/deployments/${skip}/${limit}${appendSearchParams({ reverseSorting, ...filters })}`;
  }
  static graphData(snapshot: string) {
    return `${this.baseApiUrl}/v1/graph-data/${snapshot}`;
  }
  static providerGraphData(snapshot: string) {
    return `${this.baseApiUrl}/v1/provider-graph-data/${snapshot}`;
  }
  static providerActiveLeasesGraph(providerAddress: string) {
    return `${this.baseApiUrl}/v1/providers/${providerAddress}/active-leases-graph-data`;
  }
  static providerAttributesSchema() {
    return `${this.baseApiUrl}/v1/provider-attributes-schema`;
  }
  static blockchainStatus() {
    return `${this.baseApiUrl}/v1/blockchain-status`;
  }
  static gpuModels() {
    return `${this.baseApiUrl}/v1/gpu-models`;
  }
  static providerGpus(providerAddress: string) {
    return `${this.baseApiUrl}/v1/gpu?provider=${providerAddress}`;
  }
  static trialGpuAvailability() {
    return `${this.baseApiUrl}/v1/trial-gpu-availability`;
  }
  static trialProviders() {
    return `${this.baseApiUrl}/v1/trial-providers`;
  }

  static get baseApiUrl() {
    return services.apiUrlService.getBaseApiUrlFor(networkStore.selectedNetworkId);
  }
}
