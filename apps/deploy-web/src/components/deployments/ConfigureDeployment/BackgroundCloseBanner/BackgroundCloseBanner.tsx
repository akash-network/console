import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { WarningCircle } from "iconoir-react";

interface Props {
  onRetry: () => void;
  message?: string;
}

const CLOSE_FAILED_FALLBACK = "Requesting quotes again will close it first, so nothing is left behind.";

/** Takes the lock banner's slot when a cancelled deployment's background close failed, so the form itself stays editable. */
export const BackgroundCloseBanner: FC<Props> = ({ onRetry, message }) => {
  return (
    <div className="flex shrink-0 flex-col items-start gap-1 border-b border-warning/50 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <WarningCircle className="h-4 w-4 text-warning" aria-hidden="true" />
        <span className="text-sm font-medium">Your previous deployment is still open</span>
      </div>
      <p className="min-h-10 text-sm text-muted-foreground">{message ?? CLOSE_FAILED_FALLBACK}</p>
      <Button type="button" variant="link" onClick={onRetry} className="h-auto p-0 text-sm underline">
        Retry closing it
      </Button>
    </div>
  );
};
