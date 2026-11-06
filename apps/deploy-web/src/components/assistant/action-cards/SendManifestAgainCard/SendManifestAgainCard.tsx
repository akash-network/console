"use client";
import type { FC } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useSendDeploymentAgain } from "@src/hooks/useSendDeploymentAgain/useSendDeploymentAgain";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useServices, useSendDeploymentAgain, ActionCardChrome };

export const SendManifestAgainCard: FC<ActionCardProps<"send_manifest_again"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const { requestAgain } = d.useSendDeploymentAgain();

  const sendAgain = async () => {
    const { data: leases } = await api.v1.listLeases.queryOptions({ dseq: action.dseq }).queryFn();
    await requestAgain({ dseq: action.dseq, leases: leases.map(({ id, state }) => ({ gseq: id.gseq, oseq: id.oseq, provider: id.provider, state })) });
  };

  return (
    <d.ActionCardChrome
      title="Send the deployment again"
      tier={action.tier}
      decision={decision}
      rows={[{ label: "Deployment", value: action.dseq }]}
      costNote="Sends the deployment to its provider again, which recovers one the provider lost. It doesn't restart containers, and Console has no restart action. It costs nothing."
      confirmLabel="Send again"
      successMessage="Sent. The provider should start it in a minute or two."
      onConfirm={sendAgain}
    />
  );
};
