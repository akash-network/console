import type { FC, ReactNode } from "react";
import { useId } from "react";
import { Button, Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ChevronUpIcon, CircleAlertIcon, PanelsTopLeftIcon } from "lucide-react";

import { AccountSpendGate } from "@src/components/user/AccountActionGate/AccountActionGate";
import { useDeploymentResourceSummary } from "../../DeploymentResourceSummary/useDeploymentResourceSummary";

export const DEPENDENCIES = { useDeploymentResourceSummary, AccountSpendGate };

type Props = {
  isSheetOpen: boolean;
  onSheetOpenChange: (isOpen: boolean) => void;
  sheet: ReactNode;
  isChooseProviderDisabled: boolean;
  onChooseProvider: () => void;
  /** Holds the provider choice back while set and shows why; a click still reaches `onChooseProvider`, which reports the attempt. */
  blockedReason?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const ProvidersSheetBar: FC<Props> = ({
  isSheetOpen,
  onSheetOpenChange,
  sheet,
  isChooseProviderDisabled,
  onChooseProvider,
  blockedReason,
  dependencies: d = DEPENDENCIES
}) => {
  const segments = d.useDeploymentResourceSummary();
  const blockedReasonId = useId();

  return (
    <Sheet open={isSheetOpen} onOpenChange={onSheetOpenChange}>
      <div className="flex items-center gap-3">
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your deployment</span>{" "}
              <span className="truncate font-mono text-sm font-semibold">{segments.map(segment => segment.label).join(" · ")}</span>
            </span>{" "}
            <span className="sr-only">Show providers</span>
            <ChevronUpIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <d.AccountSpendGate>
          <Button
            type="button"
            disabled={isChooseProviderDisabled}
            aria-disabled={blockedReason ? true : undefined}
            aria-describedby={blockedReason ? blockedReasonId : undefined}
            onClick={onChooseProvider}
            className={cn(
              "h-10 shrink-0 gap-2 px-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
              blockedReason && "aria-[disabled='true']:pointer-events-auto"
            )}
          >
            <PanelsTopLeftIcon className="h-4 w-4" aria-hidden="true" />
            Choose a provider
          </Button>
        </d.AccountSpendGate>
      </div>
      {blockedReason && (
        <p id={blockedReasonId} className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <CircleAlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {blockedReason}
        </p>
      )}
      <SheetContent
        side="bottom"
        hideCloseButton
        aria-describedby={undefined}
        className="flex h-[min(82dvh,720px)] flex-col gap-0 rounded-t-2xl bg-background p-0"
      >
        <SheetTitle asChild>
          <span className="sr-only">Providers</span>
        </SheetTitle>
        <SheetClose
          aria-label="Close"
          className="flex h-6 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
        </SheetClose>
        <div className="min-h-0 flex-1">{sheet}</div>
      </SheetContent>
    </Sheet>
  );
};
