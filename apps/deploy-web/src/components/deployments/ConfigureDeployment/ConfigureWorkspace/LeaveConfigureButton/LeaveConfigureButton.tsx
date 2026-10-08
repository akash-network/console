"use client";
import type { FC, MouseEvent } from "react";
import { useId, useState } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, UrlService };

type Props = {
  needsConfirmation: boolean;
  deploymentName: string;
  serviceCount: number;
  placementCount: number;
  hasBids: boolean;
  canEditInstead: boolean;
  onDiscard: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** Leaving after a discard replaces the entry instead of pushing one, so the browser's back button never returns to the closed deployment. */
export const LeaveConfigureButton: FC<Props> = ({
  needsConfirmation,
  deploymentName,
  serviceCount,
  placementCount,
  hasBids,
  canEditInstead,
  onDiscard,
  dependencies: d = DEPENDENCIES
}) => {
  const router = d.useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const descriptionId = useId();

  function confirmBeforeLeaving(event: MouseEvent<HTMLAnchorElement>) {
    if (!needsConfirmation || isOpeningElsewhere(event)) return;
    event.preventDefault();
    setIsConfirming(true);
  }

  function discardAndLeave() {
    onDiscard();
    setIsConfirming(false);
    router.replace(d.UrlService.deploymentList());
  }

  return (
    <>
      <Link
        href={d.UrlService.deploymentList()}
        onClick={confirmBeforeLeaving}
        className="inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to deployments
      </Link>
      <DialogV2 open={isConfirming} onOpenChange={setIsConfirming}>
        <DialogV2Content className="max-w-md" aria-describedby={descriptionId}>
          <DialogV2Header>
            <DialogV2Title>Leave and discard this deployment?</DialogV2Title>
            <DialogV2Description id={descriptionId}>Leaving closes the pending deployment and discards this draft. You&apos;ll lose:</DialogV2Description>
          </DialogV2Header>
          <DialogV2Body className="flex flex-col gap-3">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                {deploymentName || "Your deployment"}, with {serviceCount} {serviceCount === 1 ? "service" : "services"} across {placementCount}{" "}
                {placementCount === 1 ? "placement" : "placements"}
              </li>
              {hasBids && <li>The bids providers have sent so far</li>}
            </ul>
            {canEditInstead && <p className="text-sm text-muted-foreground">To change the configuration instead, use Edit.</p>}
          </DialogV2Body>
          <DialogV2Footer className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsConfirming(false)}>
              Keep configuring
            </Button>
            <Button type="button" variant="destructive" onClick={discardAndLeave}>
              Discard and leave
            </Button>
          </DialogV2Footer>
        </DialogV2Content>
      </DialogV2>
    </>
  );
};

function isOpeningElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
