import { config } from "./config";

export async function fetchProvider(
  provider: Provider,
  url: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }
): Promise<Response> {
  const headers = new Headers(options?.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  headers.set("Connection", "close");
  const response = await fetch(config.SERVICE_BASE_URL, {
    ...options,
    method: options?.method || "POST",
    headers,
    body: JSON.stringify({
      ...options?.body,
      url: provider.hostUri + url,
      method: options?.method || "GET",
      providerAddress: provider.owner
    })
  });
  return response;
}

export async function fetchAvailableProviders(): Promise<Provider[]> {
  const response = await fetch(`${config.CONSOLE_API_BASE_URL}/v1/providers`);
  const providers = (await response.json()) as Provider[];
  return providers.filter(provider => provider.isOnline);
}

export interface Provider {
  owner: string;
  name: string;
  isOnline: boolean;
  hostUri: string;
}
