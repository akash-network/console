import { networkVersion, BASE_API_URL, networkVersionMarket } from "./constants";
import axios from "axios";
import { appendSearchParams } from "./urlUtils";

export class ApiUrlService {
  static BASE_API_URL = `${BASE_API_URL}/v1`;
  static deploymentList(apiEndpoint: string, address: string) {
    return `${apiEndpoint}/akash/deployment/${networkVersion}/deployments/list?filters.owner=${address}`;
  }
  static deploymentDetail(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/deployment/${networkVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`;
  }
  static bidList(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/market/${networkVersionMarket}/bids/list?filters.owner=${address}&filters.dseq=${dseq}`;
  }
  static leaseList(apiEndpoint: string, address: string, dseq: string) {
    return `${apiEndpoint}/akash/market/${networkVersionMarket}/leases/list?filters.owner=${address}${dseq ? "&filters.dseq=" + dseq : ""}`;
  }
  static providers(apiEndpoint: string) {
    return `${apiEndpoint}/akash/provider/${networkVersion}/providers`;
  }
  static providerList() {
    return `${this.BASE_API_URL}/providers`;
  }
  static providerDetail(owner: string) {
    return `${this.BASE_API_URL}/providers/${owner}`;
  }
  static providerRegions() {
    return `${this.BASE_API_URL}/provider-regions`;
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
    return `${this.BASE_API_URL}/dashboard-data`;
  }
  static marketData() {
    return `${this.BASE_API_URL}/market-data`;
  }
  static proposals() {
    return `${this.BASE_API_URL}/proposals`;
  }
  static apiProviders() {
    return `${this.BASE_API_URL}/providers`;
  }
  static templates() {
    return `${this.BASE_API_URL}/templates`;
  }
  static validators() {
    return `${this.BASE_API_URL}/validators`;
  }
  static transactions(limit: number) {
    return `${this.BASE_API_URL}/transactions${appendSearchParams({ limit })}`;
  }
  static addressTransactions(address: string, skip: number, limit: number) {
    return `${this.BASE_API_URL}/addresses/${address}/transactions/${skip}/${limit}`;
  }
  static addressDeployments(address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) {
    return `${this.BASE_API_URL}/addresses/${address}/deployments/${skip}/${limit}${appendSearchParams({ reverseSorting, ...filters })}`;
  }
  static graphData(snapshot: string) {
    return `${this.BASE_API_URL}/graph-data/${snapshot}`;
  }
  static providerGraphData(snapshot: string) {
    return `${this.BASE_API_URL}/provider-graph-data/${snapshot}`;
  }
  static blocks(limit: number) {
    return `${this.BASE_API_URL}/blocks${appendSearchParams({ limit })}`;
  }
  static providerActiveLeasesGraph(providerAddress: string) {
    return `${this.BASE_API_URL}/provider-active-leases-graph-data/${providerAddress}`;
  }
  static providerAttributesSchema() {
    return `${this.BASE_API_URL}/provider-attributes-schema`;
  }
  static networkCapacity() {
    return `${this.BASE_API_URL}/network-capacity`;
  }
  // Github
  static auditors() {
    return `${this.BASE_API_URL}/auditors`;
  }
  static mainnetNodes() {
    return `${this.BASE_API_URL}/nodes/mainnet`;
  }
  static testnetNodes() {
    return `${this.BASE_API_URL}/nodes/testnet`;
  }
  static sandboxNodes() {
    return `${this.BASE_API_URL}/nodes/sandbox`;
  }
  static mainnetVersion() {
    return `${this.BASE_API_URL}/version/mainnet`;
  }
  static testnetVersion() {
    return `${this.BASE_API_URL}/version/testnet`;
  }
  static sandboxVersion() {
    return `${this.BASE_API_URL}/version/sandbox`;
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
