"use client";
import type { FC, ReactNode } from "react";

import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import { DeploymentBillingSection } from "./DeploymentBillingSection";
import { DeploymentDangerZone } from "./DeploymentDangerZone";
import { DeploymentNotificationsSection } from "./DeploymentNotificationsSection";

export const DEPENDENCIES = {
  useUser,
  useFlag,
  useDeploymentSettingQuery,
  DeploymentBillingSection,
  DeploymentNotificationsSection,
  DeploymentDangerZone
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
  const isEscrowAbstracted = d.useFlag("auto_reload_fixed_threshold");
  const { data: settings } = d.useDeploymentSettingQuery({ dseq: deployment.dseq });
  const showsBillingSection = !isEscrowAbstracted || !!settings?.runtimeLimitHours;

  return (
    <div className="space-y-8">
      {showsBillingSection && (
        <SettingsSection title="Billing">
          <d.DeploymentBillingSection deployment={deployment} leases={leases} onFundsChanged={onDeploymentChange} />
        </SettingsSection>
      )}

      <SettingsSection title="Notifications">
        <d.DeploymentNotificationsSection deployment={deployment} isEnabled={isAlertsEnabled} />
      </SettingsSection>

      {isActive && (
        <SettingsSection title="Danger Zone" destructive>
          <d.DeploymentDangerZone deployment={deployment} onClosed={onDeploymentChange} />
        </SettingsSection>
      )}
    </div>
  );
};

const SettingsSection: FC<{ title: string; destructive?: boolean; children: ReactNode }> = ({ title, destructive, children }) => (
  <section>
    <DeploymentTabHeader title={title} destructive={destructive} />
    {children}
  </section>
);
