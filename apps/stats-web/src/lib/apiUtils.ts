import { appendSearchParams } from "./urlUtils";

import { browserApiUrlService } from "@/services/api-url/browser-api-url.service";
import { networkStore } from "@/store/network.store";

export class ApiUrlService {
  static dashboardData() {
    return `${this.baseApiUrl}/v1/dashboard-data`;
  }
  static marketData() {
    return `${this.baseApiUrl}/v1/market-data`;
  }
  static proposals() {
    return `${this.baseApiUrl}/v1/proposals`;
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
  static blocks(limit: number) {
    return `${this.baseApiUrl}/v1/blocks${appendSearchParams({ limit })}`;
  }
  static providerAttributesSchema() {
    return `${this.baseApiUrl}/v1/provider-attributes-schema`;
  }
  static networkCapacity() {
    return `${this.baseApiUrl}/v1/network-capacity`;
  }

  static mainnetVersion() {
    return `${this.baseApiUrl}/v1/version/mainnet`;
  }
  static testnetVersion() {
    return `${this.baseApiUrl}/v1/version/testnet`;
  }
  static sandboxVersion() {
    return `${this.baseApiUrl}/v1/version/sandbox`;
  }

  static get baseApiUrl() {
    return browserApiUrlService.getBaseApiUrlFor(networkStore.selectedNetworkId);
  }
}
