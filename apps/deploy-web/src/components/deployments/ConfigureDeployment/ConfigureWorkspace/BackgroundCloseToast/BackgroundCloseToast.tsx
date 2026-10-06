import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react";

import type { PendingClose } from "../../useDeploymentFlow/useDeploymentFlow";
import { WorkspaceToast } from "../WorkspaceToast/WorkspaceToast";

type Props = {
  pendingClose: PendingClose;
  onRetry: () => void;
};

const CLOSE_FAILED_FALLBACK = "Requesting new bids closes it first, so nothing is left behind.";

/** Offers no dismiss, because a retry must not read as success just because the warning went away. */
export const BackgroundCloseToast: FC<Props> = ({ pendingClose, onRetry }) => {
  if (!pendingClose.failed) {
    return (
      <WorkspaceToast>
        <LoaderCircleIcon className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        <div role="status" className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Closing your previous deployment</p>
          <p className="text-sm text-muted-foreground">This finishes in the background. You can keep editing while it does.</p>
        </div>
      </WorkspaceToast>
    );
  }

  return (
    <WorkspaceToast>
      <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div role="alert" className="flex min-w-0 flex-1 flex-col items-start">
        <p className="text-sm font-semibold">Your previous deployment is still open</p>
        <p className="text-sm text-muted-foreground">{pendingClose.message ?? CLOSE_FAILED_FALLBACK}</p>
        <Button type="button" variant="link" onClick={onRetry} className="mt-1 h-auto p-0 text-sm underline">
          Retry closing it
        </Button>
      </div>
    </WorkspaceToast>
  );
};
