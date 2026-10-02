import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { CircleAlertIcon, MessageSquareIcon } from "lucide-react";

type Props = {
  onRequestCompute: () => void;
};

export const NoBidsNotice: FC<Props> = ({ onRequestCompute }) => (
  <div className="flex items-start gap-3 rounded-lg border border-zinc-300 bg-muted/40 p-4 dark:border-zinc-700">
    <CircleAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="flex min-w-0 flex-col gap-3">
      <div role="status" className="flex flex-col gap-1">
        <p className="text-sm font-semibold">No provider has bid yet</p>
        <p className="text-sm text-muted-foreground">
          A provider that matches your configuration doesn&apos;t always bid: some only take deployments from accounts on their allowlist, run custom setups, or
          reserve their capacity for private contracts.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" size="sm" onClick={onRequestCompute} className="gap-2">
          <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
          Request compute
        </Button>
        <p className="text-xs text-muted-foreground">A late bid still shows up here. To change your configuration, use Close and Edit.</p>
      </div>
    </div>
  </div>
);
