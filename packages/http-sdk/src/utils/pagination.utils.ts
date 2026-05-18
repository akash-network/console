import type { LoggerService } from "@akashnetwork/logging";

import { sdkLogger } from "./logger";

export async function getAllItems<T>(
  getItems: (params: Record<string, string | number>) => Promise<{ items: T[]; pagination: { next_key: string | null } }>,
  logger: Pick<LoggerService, "error"> = sdkLogger
): Promise<T[]> {
  let items: T[] = [];
  let nextKey: string | null = null;

  do {
    const params: Record<string, string | number> = {
      "pagination.count_total": "true"
    };
    if (nextKey) params["pagination.key"] = nextKey;

    const itemsOnPage = await getItems(params);

    // nextKey is null when the first page is returned
    if (nextKey !== null && nextKey === itemsOnPage.pagination.next_key) {
      logger.error({ event: "HTTP_SDK_CIRCULAR_LOOP", message: "Did you forget to pass pagination.key to request?" });
      break;
    }
    items = items.concat(itemsOnPage.items);
    nextKey = itemsOnPage.pagination.next_key;
  } while (nextKey);

  return items;
}
