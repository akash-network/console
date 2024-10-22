import axios from "axios";

import { browserApiUrlService } from "@src/services/api-url/browser-api-url.service";
import networkStore from "@src/store/networkStore";
import { appendSearchParams } from "./urlUtils";

export class ApiUrlService {
  static depositParams(apiEndpoint: string) {
    return `${apiEndpoint}/cosmos/params/v1beta1/params?subspace=deployment&key=MinDeposits`;
  }
  static certificatesList(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/akash/cert/${networkStore.apiVersion}/certificates/list?filter.state=valid&filter.owner=${address}`;
  }
  static deploymentList(apiEndpoint: string, address: string, isActive?: boolean) {
    return `${apiEndpoint}/akash/deployment/${networkStore.apiVersion}/deployments/list?filters.owner=${address}${isActive ? "&filters.state=active" : ""}`;
  }
  static deploymentDetail(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/deployment/${networkStore.apiVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`;
  }
  static bidList(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/market/${networkStore.marketApiVersion}/bids/list?filters.owner=${address}&filters.dseq=${dseq}`;
  }
  static trialBidList(address: string, dseq: string) {
    return `${this.baseApiUrl}/v1/trial-bids?address=${address}&dseq=${dseq}`;
  }
  static bidInfo(apiEndpoint: string, address: string, dseq: string, gseq: number, oseq: number, provider: string) {
    return `${apiEndpoint}/akash/market/${networkStore.marketApiVersion}/bids/info?id.owner=${address}&id.dseq=${dseq}&id.gseq=${gseq}&id.oseq=${oseq}&id.provider=${provider}`;
  }
  static leaseList(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/market/${networkStore.marketApiVersion}/leases/list?filters.owner=${address}${dseq ? "&filters.dseq=" + dseq : ""}`;
  }
  static providers(apiEndpoint: string) {
    return `${apiEndpoint}/akash/provider/${networkStore.apiVersion}/providers`;
  }
  static providerList() {
    return `${this.baseApiUrl}/v1/providers`;
  }
  static providerDetail(owner: string) {
    return `${this.baseApiUrl}/v1/providers/${owner}`;
  }
  static providerRegions() {
    return `${this.baseApiUrl}/v1/provider-regions`;
  }
  static block(apiEndpoint: string, id: string) {
    return `${apiEndpoint}/blocks/${id}`;
  }
  static balance(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/bank/v1beta1/balances/${address}`;
  }
  static rewards(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/distribution/v1beta1/delegators/${address}/rewards`;
  }
  static redelegations(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/staking/v1beta1/delegators/${address}/redelegations`;
  }
  static delegations(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/staking/v1beta1/delegations/${address}`;
  }
  static unbonding(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`;
  }
  static granteeGrants(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/authz/v1beta1/grants/grantee/${address}`;
  }
  static granterGrants(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/authz/v1beta1/grants/granter/${address}`;
  }
  static allowancesIssued(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/feegrant/v1beta1/issued/${address}`;
  }
  static allowancesGranted(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/cosmos/feegrant/v1beta1/allowances/${address}`;
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
  static apiProviders() {
    return `${this.baseApiUrl}/v1/providers`;
  }
  static templates() {
    return `${this.baseApiUrl}/v1/templates`;
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
  static providerActiveLeasesGraph(providerAddress: string) {
    return `${this.baseApiUrl}/v1/provider-active-leases-graph-data/${providerAddress}`;
  }
  static providerAttributesSchema() {
    return `${this.baseApiUrl}/v1/provider-attributes-schema`;
  }
  static networkCapacity() {
    return `${this.baseApiUrl}/v1/network-capacity`;
  }
  static gpuModels() {
    return `${this.baseApiUrl}/internal/gpu-models`;
  }
  static auditors() {
    return `${this.baseApiUrl}/v1/auditors`;
  }

  static get baseApiUrl() {
    return browserApiUrlService.getBaseApiUrlFor(networkStore.selectedNetworkId);
  }
}

export async function loadWithPagination<T>(baseUrl: string, dataKey: string, limit: number) {
  let items = [];
  let nextKey = null;
  // let callCount = 1;
  // let totalCount = null;

  do {
    const _hasQueryParam = hasQueryParam(baseUrl);
    let queryUrl = `${baseUrl}${_hasQueryParam ? "&" : "?"}pagination.limit=${limit}&pagination.count_total=true`;
    if (nextKey) {
      queryUrl += "&pagination.key=" + encodeURIComponent(nextKey);
    }
    // console.log(`Querying ${dataKey} [${callCount}] from : ${queryUrl}`);
    const response = await axios.get(queryUrl);
    const data = response.data;

    // if (!nextKey) {
    //   totalCount = data.pagination.total;
    // }

    items = items.concat(data[dataKey]);
    nextKey = data.pagination.next_key;
    // callCount++;

    // console.log(`Got ${items.length} of ${totalCount}`);
  } while (nextKey);

  return items.filter(item => item) as T;
}

function hasQueryParam(url: string) {
  return /[?&]/gm.test(url);
}
