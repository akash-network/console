"use client";
import type { FC } from "react";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useUser } from "@src/hooks/useUser";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DeploymentBillingSection } from "./DeploymentBillingSection";
import { DeploymentDangerZone } from "./DeploymentDangerZone";
import { DeploymentNotificationsSection } from "./DeploymentNotificationsSection";

export const DEPENDENCIES = {
  useUser,
  useDeploymentSettingQuery,
  DeploymentBillingSection,
  DeploymentNotificationsSection,
  DeploymentDangerZone,
  useProjectsUi
};

export interface DeploymentSettingsProps {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  onDeploymentChange: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentSettings: FC<DeploymentSettingsProps> = ({ deployment, leases, onDeploymentChange, dependencies: d = DEPENDENCIES }) => {
  const { user } = d.useUser();
  const isAlertsEnabled = !!user?.userId;
  const isActive = deployment.state === "active";
  const { canChangeDeployments } = d.useProjectsUi();
  const { data: settings } = d.useDeploymentSettingQuery({ dseq: deployment.dseq });
  const showsBillingSection = !!settings?.runtimeLimitHours;

  return (
    <div className="space-y-7">
      {showsBillingSection && canChangeDeployments && (
        <SettingsSection title="Billing">
          <d.DeploymentBillingSection deployment={deployment} leases={leases} onFundsChanged={onDeploymentChange} />
        </SettingsSection>
      )}

      <SettingsSection title="Notifications">
        <d.DeploymentNotificationsSection deployment={deployment} isEnabled={isAlertsEnabled} />
      </SettingsSection>

      {isActive && canChangeDeployments && (
        <SettingsSection title="Danger zone" destructive>
          <d.DeploymentDangerZone deployment={deployment} onClosed={onDeploymentChange} />
        </SettingsSection>
      )}
    </div>
  );
};
