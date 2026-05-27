import { useEffect, useState } from "react";

import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";

export function useProviderAccess(providerCredentials: UseProviderCredentialsResult): boolean {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (providerCredentials.details.usable) setHasAccess(true);
  }, [providerCredentials.details.usable]);

  return hasAccess;
}
