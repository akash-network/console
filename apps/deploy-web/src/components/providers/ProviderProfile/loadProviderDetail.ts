import type { AxiosInstance } from "axios";
import { isAxiosError } from "axios";

import type { ApiProviderDetail } from "@src/types/provider";

const UNKNOWN_PROVIDER_STATUSES = new Set([400, 404]);

/** Null when the API doesn't know the address, so the page can answer 404 instead of failing. */
export async function loadProviderDetail(httpClient: AxiosInstance, apiUrl: string, owner: string): Promise<ApiProviderDetail | null> {
  try {
    const response = await httpClient.get<ApiProviderDetail>(`${apiUrl}/v1/providers/${owner}`);
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response && UNKNOWN_PROVIDER_STATUSES.has(error.response.status)) return null;
    throw error;
  }
}
