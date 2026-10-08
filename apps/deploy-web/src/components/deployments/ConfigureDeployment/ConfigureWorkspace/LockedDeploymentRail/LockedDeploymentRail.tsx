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
    <aside
      aria-label="Locked deployment"
      className="flex min-h-0 flex-wrap items-center gap-x-3 gap-y-1 bg-muted px-4 py-3 dark:bg-muted/40 lg:h-full lg:flex-col lg:flex-nowrap lg:gap-3 lg:px-2.5 lg:py-4"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
        <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Locked</span>
      <span className="h-4 w-px shrink-0 bg-border lg:h-px lg:w-7" aria-hidden="true" />
      <Button
        type="button"
        variant="outline"
        onClick={onEdit}
        aria-describedby={hintId}
        className="order-2 h-auto gap-2 rounded-xl border-2 border-foreground bg-background px-4 py-2 text-sm font-semibold shadow-sm hover:animate-none focus-visible:animate-none motion-safe:animate-edit-nudge dark:bg-background lg:order-none lg:w-full lg:flex-col lg:gap-1 lg:px-2 lg:py-2.5"
      >
        <PencilIcon className="h-4 w-4" aria-hidden="true" />
        Edit
      </Button>
      <span id={hintId} className="order-3 basis-full text-right text-[11px] leading-snug text-muted-foreground lg:order-none lg:basis-auto lg:text-center">
        unlocks · bids reset
      </span>
      <span className="order-1 min-w-0 flex-1 truncate font-mono text-[11px] tracking-wider text-muted-foreground lg:order-none lg:mt-auto lg:min-h-0 lg:flex-initial lg:rotate-180 lg:[writing-mode:vertical-rl]">
        <span className="hidden lg:inline">
          <span className="font-semibold uppercase">Deployment</span> ·
        </span>{" "}
        {deploymentName || "Untitled"}
      </span>
    </aside>
  );
};
