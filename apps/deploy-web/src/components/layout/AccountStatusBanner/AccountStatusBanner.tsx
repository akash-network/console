"use client";
import { Banner } from "@akashnetwork/ui/components";

import { SUPPORT_EMAIL } from "@src/config/ui.config";
import { useAccountStatus } from "@src/hooks/useAccountStatus/useAccountStatus";

export const DEPENDENCIES = { useAccountStatus };

const SUSPENDED_NOTICE =
  "Your account is suspended. You can still view your balance, deployments and billing and close deployments, but you can't deploy or add funds.";
const TERMINATED_NOTICE = "Your account has been terminated. This decision is final.";

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function AccountStatusBanner({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { status, reason, isTerminated } = d.useAccountStatus();

  if (status === "active") return null;

  return (
    <Banner variant={isTerminated ? "error" : "warning"} role="status">
      <span className="flex flex-col gap-1 sm:block">
        <span>{isTerminated ? TERMINATED_NOTICE : SUSPENDED_NOTICE}</span>
        {reason && <span className="sm:ml-1">Reason: {reason}</span>}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline hover:opacity-80 sm:ml-3">
          Contact support
        </a>
      </span>
    </Banner>
  );
}
