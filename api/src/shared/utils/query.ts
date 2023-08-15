export async function loadWithPagination(baseUrl: string, dataKey: string, limit: number) {
  let items = [];
  let nextKey = null;
  let callCount = 1;
  let totalCount = null;

  do {
    let queryUrl = baseUrl + "?pagination.limit=" + limit + "&pagination.count_total=true";
    if (nextKey) {
      queryUrl += "&pagination.key=" + encodeURIComponent(nextKey);
    }
    console.log(`Querying ${dataKey} [${callCount}] from : ${queryUrl}`);
    const response = await fetch(queryUrl);
    const data = await response.json();

    if (!nextKey) {
      totalCount = data.pagination.total;
    }

    items = items.concat(data[dataKey]);
    nextKey = data.pagination.next_key;
    callCount++;

    console.log(`Got ${items.length} of ${totalCount}`);
  } while (nextKey);

  return items.filter((item) => item);
}