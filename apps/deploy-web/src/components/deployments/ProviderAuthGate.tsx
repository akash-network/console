import type { JwtTokenAccessScope } from "@akashnetwork/chain-sdk/web";
import { Alert, AlertDescription, AlertTitle, Skeleton } from "@akashnetwork/ui/components";
import { CircleAlert, Info } from "lucide-react";

import type { ProviderTokenMode } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { canRequestScope } from "@src/hooks/useProviderCredentials/useProviderCredentials";

export const ORGANIZATION_UNAVAILABLE_MESSAGE = "Couldn't load your organization. Reload to retry.";

export function ProviderAuthFallback({
  hasAccess,
  error,
  tokenMode,
  scope,
  viewOnlyMessage
}: {
  hasAccess: boolean;
  error: Error | null;
  tokenMode: ProviderTokenMode;
  scope: readonly JwtTokenAccessScope[];
  viewOnlyMessage: string;
}) {
  if (!canRequestScope(tokenMode, scope)) return <ProviderAccessUnavailableAlert message={viewOnlyMessage} />;
  if (tokenMode === "organization-unavailable") return <ProviderAccessUnavailableAlert message={ORGANIZATION_UNAVAILABLE_MESSAGE} />;
  if (error) return <ProviderAuthErrorAlert />;
  if (!hasAccess) return <ProviderAuthSkeleton />;
  return null;
}

function ProviderAccessUnavailableAlert({ message }: { message: string }) {
  return (
    <Alert className="mt-4 p-4">
      <Info className="h-4 w-4" />
      <AlertDescription className="text-sm">{message}</AlertDescription>
    </Alert>
  );
}

function ProviderAuthErrorAlert() {
  return (
    <Alert variant="warning" className="mt-4 p-4">
      <CircleAlert className="h-4 w-4" />
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
