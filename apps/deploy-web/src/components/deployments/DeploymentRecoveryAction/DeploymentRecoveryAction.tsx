"use client";
import type { FC } from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import Link from "next/link";

import type { DeploymentRecovery } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import { useSendDeploymentAgain } from "@src/hooks/useSendDeploymentAgain/useSendDeploymentAgain";
import type { LeaseDto } from "@src/types/deployment";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useSendDeploymentAgain };

const COMPACT_STYLE = { variant: "link", size: "xs", className: "h-auto p-0 text-xs" } as const;

const REGULAR_STYLE = { variant: "default", size: "sm" } as const;

export interface DeploymentRecoveryActionProps {
  dseq: string;
  recovery: DeploymentRecovery;
  leases: LeaseDto[];
  isCompact?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

/** The configure page sends a deployment that already holds a lease back to its own page, so one whose provider never got it is sent again instead, and one whose provider closed it is closed from its settings. */
export const DeploymentRecoveryAction: FC<DeploymentRecoveryActionProps> = ({ dseq, recovery, leases, isCompact, dependencies: d = DEPENDENCIES }) => {
  const { sendAgain, isSending } = d.useSendDeploymentAgain();
  const style = isCompact ? COMPACT_STYLE : REGULAR_STYLE;

  if (recovery === "send-again") {
    return (
      <Button type="button" {...style} disabled={isSending} onClick={() => sendAgain({ dseq, leases })}>
        Send again
      </Button>
    );
  }

  if (recovery === "close") {
    return (
      <Link href={UrlService.deploymentDetails(dseq, "SETTINGS")} className={buttonVariants(style)}>
        Open settings
      </Link>
    );
  }

  return (
    <Link href={UrlService.configureDeployment({ dseq })} className={buttonVariants(style)}>
      Choose a provider
    </Link>
  );
};
