"use client";
import type { FC } from "react";
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
import { NavArrowLeft } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useHasInAppHistory } from "@src/hooks/useHasInAppHistory";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, useHasInAppHistory, UrlService };

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
  const hasInAppHistory = d.useHasInAppHistory();
  const [isConfirming, setIsConfirming] = useState(false);
  const descriptionId = useId();

  function requestLeave() {
    if (needsConfirmation) {
      setIsConfirming(true);
    } else if (hasInAppHistory) {
      router.back();
    } else {
      router.push(d.UrlService.onboardingPicker());
    }
  }

  function discardAndLeave() {
    onDiscard();
    setIsConfirming(false);
    if (hasInAppHistory) {
      router.back();
    } else {
      router.replace(d.UrlService.onboardingPicker());
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label="Back" onClick={requestLeave} className="-ml-2 text-muted-foreground">
        <NavArrowLeft className="h-5 w-5" />
      </Button>
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
            {canEditInstead && <p className="text-sm text-muted-foreground">To change the configuration instead, use Edit on the left.</p>}
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
