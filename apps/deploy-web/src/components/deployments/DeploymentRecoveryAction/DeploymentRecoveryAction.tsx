"use client";
import type { FC } from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import Link from "next/link";

import { useSendDeploymentAgain } from "@src/hooks/useSendDeploymentAgain/useSendDeploymentAgain";
import type { LeaseDto } from "@src/types/deployment";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useSendDeploymentAgain };

const COMPACT_STYLE = { variant: "link", size: "xs", className: "h-auto p-0 text-xs" } as const;

const REGULAR_STYLE = { variant: "default", size: "sm" } as const;

export interface DeploymentRecoveryActionProps {
  dseq: string;
  hasLease: boolean;
  leases: LeaseDto[];
  isCompact?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

/** The configure page sends a deployment that already holds a lease back to its own page, so one whose provider never got it is sent again instead. */
export const DeploymentRecoveryAction: FC<DeploymentRecoveryActionProps> = ({ dseq, hasLease, leases, isCompact, dependencies: d = DEPENDENCIES }) => {
  const { sendAgain, isSending } = d.useSendDeploymentAgain();
  const style = isCompact ? COMPACT_STYLE : REGULAR_STYLE;

  if (hasLease) {
    return (
      <Button type="button" {...style} disabled={isSending} onClick={() => sendAgain(leases)}>
        Send again
      </Button>
    );
  }

  return (
    <Link href={UrlService.configureDeployment({ dseq })} className={buttonVariants(style)}>
      Choose a provider
    </Link>
  );
};
