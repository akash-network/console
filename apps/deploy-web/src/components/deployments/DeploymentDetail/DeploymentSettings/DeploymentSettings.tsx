"use client";
import type { FC, ReactNode } from "react";

import { useUser } from "@src/hooks/useUser";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import { DeploymentBillingSection } from "./DeploymentBillingSection";
import { DeploymentDangerZone } from "./DeploymentDangerZone";
import { DeploymentNotificationsSection } from "./DeploymentNotificationsSection";

export const DEPENDENCIES = {
  useUser,
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

  return (
    <div className="space-y-8">
      <SettingsSection title="Billing">
        <d.DeploymentBillingSection deployment={deployment} leases={leases} onFundsChanged={onDeploymentChange} />
      </SettingsSection>

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
