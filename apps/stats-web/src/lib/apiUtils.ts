import axios from "axios";

import { BASE_API_URL, networkVersion } from "./constants";
import { appendSearchParams } from "./urlUtils";

export class ApiUrlService {
  static dashboardData() {
    return `${BASE_API_URL}/v1/dashboard-data`;
  }
  static marketData() {
    return `${BASE_API_URL}/v1/market-data`;
  }
  static proposals() {
    return `${BASE_API_URL}/v1/proposals`;
  }
  static validators() {
    return `${BASE_API_URL}/v1/validators`;
  }
  static transactions(limit: number) {
    return `${BASE_API_URL}/v1/transactions${appendSearchParams({ limit })}`;
  }
  static addressTransactions(address: string, skip: number, limit: number) {
    return `${BASE_API_URL}/v1/addresses/${address}/transactions/${skip}/${limit}`;
  }
  static addressDeployments(address: string, skip: number, limit: number, reverseSorting: boolean, filters: { [key: string]: string }) {
    return `${BASE_API_URL}/v1/addresses/${address}/deployments/${skip}/${limit}${appendSearchParams({ reverseSorting, ...filters })}`;
  }
  static graphData(snapshot: string) {
    return `${BASE_API_URL}/v1/graph-data/${snapshot}`;
  }
  static providerGraphData(snapshot: string) {
    return `${BASE_API_URL}/v1/provider-graph-data/${snapshot}`;
  }
  static blocks(limit: number) {
    return `${BASE_API_URL}/v1/blocks${appendSearchParams({ limit })}`;
  }
  static providerAttributesSchema() {
    return `${BASE_API_URL}/v1/provider-attributes-schema`;
  }
  static networkCapacity() {
    return `${BASE_API_URL}/v1/network-capacity`;
  }

  static mainnetVersion() {
    return `${BASE_API_URL}/v1/version/mainnet`;
  }
  static testnetVersion() {
    return `${BASE_API_URL}/v1/version/testnet`;
  }
  static sandboxVersion() {
    return `${BASE_API_URL}/v1/version/sandbox`;
  }
}

export async function loadWithPagination(baseUrl: string, dataKey: string, limit: number) {
  let items: any[] = [];
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
