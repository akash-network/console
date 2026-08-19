"use client";
import type { FC } from "react";

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
    return <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Sign in to configure notifications for this deployment.</div>;
  }

  return <d.DeploymentAlerts deployment={deployment} onStateChange={() => undefined} />;
};
