"use client";
import type { FC } from "react";
import { Bell } from "lucide-react";

import { DeploymentAlerts } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import type { DeploymentDto } from "@src/types/deployment";

export const DEPENDENCIES = { DeploymentAlerts };

export interface DeploymentNotificationsSectionProps {
  deployment: DeploymentDto;
  isEnabled: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentNotificationsSection: FC<DeploymentNotificationsSectionProps> = ({ deployment, isEnabled, dependencies: d = DEPENDENCIES }) => {
  if (!isEnabled) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-[13px] text-muted-foreground sm:px-[22px]">
        <Bell className="h-4 w-4 shrink-0" aria-hidden />
        Sign in to configure notifications for this deployment.
      </div>
    );
  }

  return <d.DeploymentAlerts deployment={deployment} onStateChange={() => undefined} />;
};
