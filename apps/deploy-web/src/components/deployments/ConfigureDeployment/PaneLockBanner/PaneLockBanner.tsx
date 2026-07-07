import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Lock } from "iconoir-react";

interface Props {
  onCancelAndEdit: () => void;
  isClosing?: boolean;
}

/**
 * Banner added to the top of a spec pane while quotes are active; the pane's own header and its
 * SDL-mutating controls below stay in place (the controls are disabled by the pane). Mirrors the
 * Figma "Locked / Cancel and edit" affordance and reflects close progress — the action reads
 * "Cancelling…" and is disabled while the deployment closes.
 */
export const PaneLockBanner: FC<Props> = ({ onCancelAndEdit, isClosing }) => {
  return (
    <div className="flex shrink-0 flex-col items-start gap-1 border-b border-zinc-300 bg-accent px-4 py-3 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">Locked</span>
      </div>
      <p className="min-h-10 text-sm text-muted-foreground">Changing a locked setting needs new quotes.</p>
      <Button type="button" variant="link" onClick={onCancelAndEdit} disabled={isClosing} className="h-auto p-0 text-sm underline">
        {isClosing ? "Cancelling…" : "Cancel and edit"}
      </Button>
    </div>
  );
};
