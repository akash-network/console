import { useRef } from "react";

import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";

export function useProviderAccess(providerCredentials: UseProviderCredentialsResult): boolean {
  const hasAccessRef = useRef(providerCredentials.details.usable);
  if (providerCredentials.details.usable) hasAccessRef.current = true;
  return hasAccessRef.current;
}
