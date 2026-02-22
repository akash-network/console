import { z } from "zod";

const BASE_URL = z.string().url().parse(process.env.TEST_API_BASE_URL);

export async function requestApi<T>(url: string, options?: ApiRequestInit): Promise<{ response: Response; data: T }> {
  const response = await fetch(BASE_URL + url, options);

  if (!response.ok && options?.returnNokOkResponse) {
    return {
      response,
      data: {} as T
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed with status ${response.status}: ${errorText}`);
  }

  return {
    response,
    data: (await response.json()) as T
  };
}

export interface ApiRequestInit extends RequestInit {
  returnNokOkResponse?: boolean;
}
