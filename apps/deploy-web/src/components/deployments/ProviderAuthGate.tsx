import { type ReactNode, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Skeleton } from "@akashnetwork/ui/components";
import { WarningCircle } from "iconoir-react";

import type { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";

export function useProviderAuthGate(providerCredentials: ReturnType<typeof useProviderCredentials>): {
  hasAccess: boolean;
  fallback: ReactNode;
} {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (providerCredentials.details.usable) setHasAccess(true);
  }, [providerCredentials.details.usable]);

  const { error } = providerCredentials.details;

  if (error) {
    return { hasAccess, fallback: <ProviderAuthErrorAlert /> };
  }

  if (!hasAccess) {
    return { hasAccess: false, fallback: <ProviderAuthSkeleton /> };
  }

  return { hasAccess: true, fallback: null };
}

function ProviderAuthErrorAlert() {
  return (
    <Alert variant="warning" className="mt-4 p-4">
      <WarningCircle className="h-4 w-4" />
      <AlertTitle className="mb-1 text-sm">Could not authorize with the provider</AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">Please retry once the network has recovered.</AlertDescription>
    </Alert>
  );
}

function ProviderAuthSkeleton() {
  return (
    <div className="mt-4 space-y-2">
      <Skeleton className="h-[56px] w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
