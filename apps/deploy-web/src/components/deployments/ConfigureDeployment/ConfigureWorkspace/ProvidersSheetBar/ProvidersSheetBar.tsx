import type { FC, ReactNode } from "react";
import { Button, Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@akashnetwork/ui/components";
import { ChevronUpIcon, PanelsTopLeftIcon } from "lucide-react";

import { useDeploymentResourceSummary } from "../../DeploymentResourceSummary/useDeploymentResourceSummary";

export const DEPENDENCIES = { useDeploymentResourceSummary };

type Props = {
  isSheetOpen: boolean;
  onSheetOpenChange: (isOpen: boolean) => void;
  sheet: ReactNode;
  isChooseProviderDisabled: boolean;
  onChooseProvider: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ProvidersSheetBar: FC<Props> = ({
  isSheetOpen,
  onSheetOpenChange,
  sheet,
  isChooseProviderDisabled,
  onChooseProvider,
  dependencies: d = DEPENDENCIES
}) => {
  const segments = d.useDeploymentResourceSummary();

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
        <Button type="button" disabled={isChooseProviderDisabled} onClick={onChooseProvider} className="h-10 shrink-0 gap-2 px-4">
          <PanelsTopLeftIcon className="h-4 w-4" aria-hidden="true" />
          Choose a provider
        </Button>
      </div>
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
