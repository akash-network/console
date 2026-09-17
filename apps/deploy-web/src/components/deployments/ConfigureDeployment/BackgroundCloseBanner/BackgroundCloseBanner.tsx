import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { WarningCircle } from "iconoir-react";
import { LoaderCircle } from "lucide-react";

import type { PendingClose } from "../useDeploymentFlow/useDeploymentFlow";

interface Props {
  pendingClose: PendingClose;
  onRetry: () => void;
}

const CLOSE_FAILED_FALLBACK = "Requesting quotes again will close it first, so nothing is left behind.";

/**
 * Takes the lock banner's slot for as long as a cancelled deployment is unaccounted for, so the form stays editable
 * while the close stays visible: a retry must not read as success just because the warning went away.
 */
export const BackgroundCloseBanner: FC<Props> = ({ pendingClose, onRetry }) => {
  if (!pendingClose.failed) {
    return (
      <div role="status" className="flex shrink-0 flex-col items-start gap-1 border-b border-zinc-300 bg-accent px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Closing your previous deployment</span>
        </div>
        <p className="min-h-10 text-sm text-muted-foreground">This finishes in the background. You can keep editing while it does.</p>
      </div>
    );
  }

  return (
    <div role="alert" className="flex shrink-0 flex-col items-start gap-1 border-b border-warning/50 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <WarningCircle className="h-4 w-4 text-warning" aria-hidden="true" />
        <span className="text-sm font-medium">Your previous deployment is still open</span>
      </div>
      <p className="min-h-10 text-sm text-muted-foreground">{pendingClose.message ?? CLOSE_FAILED_FALLBACK}</p>
      <Button type="button" variant="link" onClick={onRetry} className="h-auto p-0 text-sm underline">
        Retry closing it
      </Button>
    </div>
  );
};
