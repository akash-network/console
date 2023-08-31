import { networkVersion, BASE_API_URL } from "./constants";
import axios from "axios";
import { appendSearchParams } from "./urlUtils";

export class ApiUrlService {
  static deploymentList(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/akash/deployment/${networkVersion}/deployments/list?filters.owner=${address}`;
  }
  static deploymentDetail(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/deployment/${networkVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`;
  }
  static bidList(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/market/${networkVersion}/bids/list?filters.owner=${address}&filters.dseq=${dseq}`;
  }
  static leaseList(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/market/${networkVersion}/leases/list?filters.owner=${address}${dseq ? "&filters.dseq=" + dseq : ""}`;
  }
  static providers(apiEndpoint: string) {
    return `${apiEndpoint}/akash/provider/${networkVersion}/providers`;
  }
  static providerDetail(apiEndpoint: string, owner: string) {
    return `${apiEndpoint}/akash/provider/${networkVersion}/providers/${owner}`;
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
  static dashboardData() {
    return `${BASE_API_URL}/dashboardData`;
  }
  static marketData() {
    return `${BASE_API_URL}/marketData`;
  }
  static proposals() {
    return `${BASE_API_URL}/proposals`;
  }
  static apiProviders() {
    return `${BASE_API_URL}/providers`;
  }
  static templates() {
    return `${BASE_API_URL}/templates`;
  }
  static validators() {
    return `${BASE_API_URL}/validators`;
  }
  static transactions(limit: number) {
    return `${BASE_API_URL}/transactions${appendSearchParams({ limit })}`;
  }
  static addressTransactions(address: string, skip: number, limit: number) {
    return `${BASE_API_URL}/addresses/${address}/transactions/${skip}/${limit}`;
  }
  static addressDeployments(address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) {
    return `${BASE_API_URL}/addresses/${address}/deployments/${skip}/${limit}${appendSearchParams({ reverseSorting, ...filters })}`;
  }
  static graphData(snapshot: string) {
    return `${BASE_API_URL}/getGraphData/${snapshot}`;
  }
  static providerGraphData(snapshot: string) {
    return `${BASE_API_URL}/getProviderGraphData/${snapshot}`;
  }
  static blocks(limit: number) {
    return `${BASE_API_URL}/blocks${appendSearchParams({ limit })}`;
  }
  static providerActiveLeasesGraph(providerAddress: string) {
    return `${BASE_API_URL}/getProviderActiveLeasesGraphData/${providerAddress}`;
  }
  static providerAttributesSchema() {
    return `${BASE_API_URL}/getProviderAttributesSchema`;
  }
  static networkCapacity() {
    return `${BASE_API_URL}/getNetworkCapacity`;
  }
  // Github
  static auditors() {
    return `${BASE_API_URL}/getAuditors`;
  }
  static mainnetNodes() {
    return `${BASE_API_URL}/getMainnetNodes`;
  }
  static testnetNodes() {
    return `${BASE_API_URL}/getTestnetNodes`;
  }
  static sandboxNodes() {
    return `${BASE_API_URL}/getSandboxNodes`;
  }
  static mainnetVersion() {
    return `${BASE_API_URL}/getMainnetVersion`;
  }
  static testnetVersion() {
    return `${BASE_API_URL}/getTestnetVersion`;
  }
  static sandboxVersion() {
    return `${BASE_API_URL}/getSandboxVersion`;
  }
}

export async function loadWithPagination(baseUrl: string, dataKey: string, limit: number) {
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

  return items.filter(item => item);
}

function hasQueryParam(url: string) {
  return /[?&]/gm.test(url);
}
