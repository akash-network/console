import type { FC } from "react";
import { useId } from "react";
import { Button } from "@akashnetwork/ui/components";
import { LockIcon } from "lucide-react";

type Props = {
  deploymentName: string;
  onEdit: () => void;
};

export const LockedDeploymentRail: FC<Props> = ({ deploymentName, onEdit }) => {
  const hintId = useId();

  return (
    <aside aria-label="Locked deployment" className="flex h-full min-h-0 flex-col items-center gap-2 px-2 py-4">
      <LockIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Locked</span>
      <Button type="button" variant="outline" size="sm" onClick={onEdit} aria-describedby={hintId} className="h-8 w-full px-2 text-xs">
        Edit
      </Button>
      <span id={hintId} className="text-center text-[10px] leading-tight text-muted-foreground">
        unlocks · bids reset
      </span>
      <span className="mt-6 min-h-0 overflow-hidden whitespace-nowrap font-mono text-xs uppercase text-muted-foreground [writing-mode:vertical-rl]">
        Deployment · {deploymentName || "Untitled"}
      </span>
    </aside>
  );
};
