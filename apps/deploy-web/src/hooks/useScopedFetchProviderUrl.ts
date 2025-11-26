import { useCallback } from "react";
import type { AxiosResponse } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { ProviderIdentity, ProviderProxyPayload } from "@src/services/provider-proxy/provider-proxy.service";

export function useScopedFetchProviderUrl(provider: ProviderIdentity | undefined | null): ScopedFetchProviderUrl {
  const { providerProxy } = useServices();
  return useCallback(
    (url, options) => {
      if (!provider) return new Promise(() => {});
      return providerProxy.request(url, {
        ...options,
        providerIdentity: provider
      });
    },
    [provider?.hostUri, provider?.owner]
  );
}

export type ScopedFetchProviderUrlOptions = Omit<ProviderProxyPayload, "providerIdentity">;
export type ScopedFetchProviderUrl = <T>(url: string, options?: ScopedFetchProviderUrlOptions) => Promise<AxiosResponse<T>>;
