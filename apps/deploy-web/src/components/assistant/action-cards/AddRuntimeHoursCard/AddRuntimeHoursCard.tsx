"use client";
import type { FC } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useUpdateDeploymentSettingMutation } from "@src/queries/deploymentSettingsQuery";
import { API_BLOCKS_PER_HOUR } from "@src/utils/deploymentUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/utils/runtimeLimitUtils";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { formatUsd } from "../formatUsd";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = { useServices, usePricing, useUpdateDeploymentSettingMutation, useDeploymentName, ActionCardChrome };

export const AddRuntimeHoursCard: FC<ActionCardProps<"add_runtime_hours"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const { udenomToUsd } = d.usePricing();
  const { mutateAsync: updateSetting } = d.useUpdateDeploymentSettingMutation({ dseq: action.dseq });
  const deploymentName = d.useDeploymentName(action.dseq);
  const { data: leases } = api.v1.listLeases.useQuery({ dseq: action.dseq }, { select: response => response.data.filter(isLeaseLive) });

  const spendUsd = leases?.length
    ? udenomToUsd(leases.reduce((total, lease) => total + parseFloat(lease.price.amount), 0) * API_BLOCKS_PER_HOUR * action.hours, leases[0].price.denom)
    : null;
  const spendNote =
    spendUsd === null
      ? "Spends credits to fund the extra hours at the deployment's current rate."
      : `Spends about ${formatUsd(spendUsd)} of credits to fund them.`;

  return (
    <d.ActionCardChrome
      title="Add runtime hours"
      scope={<DeploymentLink dseq={action.dseq} name={deploymentName} />}
      tier={action.tier}
      decision={decision}
      rows={[
        { label: "Current limit", value: `${action.currentLimitHours}h` },
        { label: "Adding", value: `${action.hours}h` },
        { label: "New limit", value: `${action.newLimitHours}h` }
      ]}
      costNote={`${spendNote} One request adds at most ${MAX_RUNTIME_LIMIT_INCREMENT_HOURS} hours.`}
      confirmLabel={`Add ${action.hours} hours`}
      successMessage={`The deployment now closes after ${action.newLimitHours}h.`}
      onConfirm={async () => {
        await updateSetting({ runtimeLimitHours: action.newLimitHours });
      }}
    />
  );
};
