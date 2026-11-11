import type { FC, ReactNode } from "react";
import { useId } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CircleAlertIcon } from "lucide-react";

type Props = {
  reason: string;
  onAttempt?: () => void;
  className?: string;
  children: ReactNode;
};

/** Stays clickable while held back, so an attempt can reveal what blocks it, which a disabled button never reports. */
export const BlockedActionButton: FC<Props> = ({ reason, onAttempt, className, children }) => {
  const reasonId = useId();

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        aria-disabled="true"
        aria-describedby={reasonId}
        onClick={onAttempt}
        className={cn(className, "cursor-not-allowed opacity-50 aria-[disabled='true']:pointer-events-auto")}
      >
        {children}
      </Button>
      <p id={reasonId} className="flex items-center gap-1 text-xs text-destructive">
        <CircleAlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {reason}
      </p>
    </div>
  );
};
