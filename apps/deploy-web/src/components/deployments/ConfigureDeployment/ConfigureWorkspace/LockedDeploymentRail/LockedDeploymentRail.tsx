import type { FC } from "react";
import { useId } from "react";
import { Button } from "@akashnetwork/ui/components";
import { LockIcon, PencilIcon } from "lucide-react";

type Props = {
  deploymentName: string;
  onEdit: () => void;
};

export const LockedDeploymentRail: FC<Props> = ({ deploymentName, onEdit }) => {
  const hintId = useId();

  return (
    <aside aria-label="Locked deployment" className="flex h-full min-h-0 flex-col items-center gap-3 bg-muted px-2.5 py-4 dark:bg-muted/40">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
        <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Locked</span>
      <span className="h-px w-7 shrink-0 bg-border" aria-hidden="true" />
      <Button
        type="button"
        variant="outline"
        onClick={onEdit}
        aria-describedby={hintId}
        className="h-auto w-full flex-col gap-1 rounded-xl border-2 border-foreground bg-background px-2 py-2.5 text-sm font-semibold shadow-sm hover:animate-none focus-visible:animate-none motion-safe:animate-edit-nudge dark:bg-background"
      >
        <PencilIcon className="h-4 w-4" aria-hidden="true" />
        Edit
      </Button>
      <span id={hintId} className="text-center text-[11px] leading-snug text-muted-foreground">
        unlocks · bids reset
      </span>
      <span className="mt-auto min-h-0 rotate-180 truncate font-mono text-[11px] tracking-wider text-muted-foreground [writing-mode:vertical-rl]">
        <span className="font-semibold uppercase">Deployment</span> · {deploymentName || "Untitled"}
      </span>
    </aside>
  );
};
