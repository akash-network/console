import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { CircleAlertIcon, MessageSquareIcon } from "lucide-react";

import { AskAssistantButton } from "@src/components/assistant/AskAssistantButton/AskAssistantButton";
import { useNotifyMe } from "@src/components/gpu-alerts/useNotifyMe/useNotifyMe";
import type { NotifiableGpuSetup } from "../../AvailabilityPane/gpuAvailability/gpuAvailability";

export const DEPENDENCIES = { AskAssistantButton, useNotifyMe };

export const WHY_NO_BIDS_QUESTION = "Why isn't my deployment getting any bids?";

type Props = {
  requestLabel?: string;
  dseq: string | null;
  gpu?: NotifiableGpuSetup | null;
  gpuLabel?: string;
  isQuoteFlowEnabled?: boolean;
  onRequestCompute: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const NoBidsNotice: FC<Props> = ({
  requestLabel = "Request compute",
  dseq,
  gpu,
  gpuLabel,
  isQuoteFlowEnabled = false,
  onRequestCompute,
  dependencies: d = DEPENDENCIES
}) => {
  const notifyMe = d.useNotifyMe();
  const notifiableGpu = notifyMe.isEnabled ? gpu : null;
  const waiting = notifiableGpu ? notifyMe.findEntry(notifiableGpu) : undefined;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-300 bg-muted/40 p-4 dark:border-zinc-700">
      <CircleAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-3">
        <div role="status" className="flex flex-col gap-1">
          <p className="text-sm font-semibold">No provider has bid yet</p>
          <p className="text-sm text-muted-foreground">
            A provider that matches your configuration doesn&apos;t always bid: some only take deployments from accounts on their allowlist, run custom setups,
            or reserve their capacity for private contracts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {notifiableGpu ? (
            <>
              {waiting ? (
                <p className="text-sm font-medium">Waiting · #{waiting.placeInLine} in line</p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={notifyMe.isPending}
                  onClick={() => notifyMe.notify({ ...notifiableGpu, label: gpuLabel }, "no_bids")}
                  className="gap-2"
                >
                  Notify me when available
                </Button>
              )}
              <Button type="button" variant="link" size="sm" onClick={onRequestCompute} className="h-auto p-0 text-xs">
                {isQuoteFlowEnabled ? "Need it guaranteed? Reserve capacity" : requestLabel}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={onRequestCompute} className="gap-2">
              <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
              {requestLabel}
            </Button>
          )}
          {dseq && <d.AskAssistantButton dseq={dseq} question={WHY_NO_BIDS_QUESTION} label="Why no bids?" />}
          <p className="text-xs text-muted-foreground">A late bid still shows up here. To change your configuration, use Close and Edit.</p>
        </div>
      </div>
    </div>
  );
};
