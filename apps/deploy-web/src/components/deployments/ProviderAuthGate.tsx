import { Alert, AlertDescription, AlertTitle, Skeleton } from "@akashnetwork/ui/components";
import { WarningCircle } from "iconoir-react";

export function ProviderAuthFallback({ hasAccess, error }: { hasAccess: boolean; error: Error | null }) {
  if (error) return <ProviderAuthErrorAlert />;
  if (!hasAccess) return <ProviderAuthSkeleton />;
  return null;
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
