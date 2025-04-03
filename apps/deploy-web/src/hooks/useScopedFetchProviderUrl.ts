import { useCallback } from "react";
import type { AxiosResponse } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { ProviderIdentity, ProviderProxyPayload } from "@src/services/provider-proxy/provider-proxy.service";
import networkStore from "@src/store/networkStore";

export function useScopedFetchProviderUrl(provider: ProviderIdentity | undefined | null): ScopedFetchProviderUrl {
  const chainNetwork = networkStore.useSelectedNetworkId();
  const { providerProxy } = useServices();
  return useCallback(
    (url, options) => {
      if (!provider) return new Promise(() => {});
      return providerProxy.fetchProviderUrl(url, {
        ...options,
        chainNetwork,
        providerIdentity: provider
      });
    },
    [provider?.hostUri, provider?.owner, chainNetwork]
  );
}

export type ScopedFetchProviderUrlOptions = Omit<ProviderProxyPayload, "chainNetwork" | "providerIdentity">;
export type ScopedFetchProviderUrl = <T>(url: string, options?: ScopedFetchProviderUrlOptions) => Promise<AxiosResponse<T>>;
