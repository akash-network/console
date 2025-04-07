/**
 * Helper function to load data with pagination
 * @param baseUrl Base URL for the API request
 * @param dataKey Key in the response that contains the data array
 * @param limit Number of items per page
 * @param httpClient HTTP client to use for requests
 * @returns Array of items from all pages
 */
export async function loadWithPagination<T>(baseUrl: string, dataKey: string, limit: number, httpClient: { get: (url: string) => Promise<any> }): Promise<T[]> {
  let items: T[] = [];
  let nextKey: string | null = null;

  do {
    const hasQueryParam = /[?&]/gm.test(baseUrl);
    let queryUrl = `${baseUrl}${hasQueryParam ? "&" : "?"}pagination.limit=${limit}&pagination.count_total=true`;
    if (nextKey) {
      queryUrl += "&pagination.key=" + encodeURIComponent(nextKey);
    }

    const response = await httpClient.get(queryUrl);
    const data = response.data;

    items = items.concat(data[dataKey]);
    nextKey = data.pagination.next_key;
  } while (nextKey);

  return items.filter(item => item) as T[];
}

/**
 * Helper function to check if a URL has query parameters
 * @param url URL to check
 * @returns Boolean indicating if the URL has query parameters
 */
export function hasQueryParam(url: string): boolean {
  return /[?&]/gm.test(url);
}
