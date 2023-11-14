import { networkVersion, BASE_API_URL } from "./constants";
import axios from "axios";
import { appendSearchParams } from "./urlUtils";

export class ApiUrlService {
  static dashboardData() {
    return `${BASE_API_URL}/dashboardData`;
  }
  static marketData() {
    return `${BASE_API_URL}/marketData`;
  }
  static proposals() {
    return `${BASE_API_URL}/proposals`;
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
  static providerAttributesSchema() {
    return `${BASE_API_URL}/getProviderAttributesSchema`;
  }
  static networkCapacity() {
    return `${BASE_API_URL}/getNetworkCapacity`;
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
