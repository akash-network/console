"use client";
import type { FC } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { GenericActionCard } from "../GenericActionCard/GenericActionCard";

export const DEPENDENCIES = { useServices, useQueryClient, useFlag, ActionCardChrome, GenericActionCard };

/** The page the alerts settings list their channels with, so the card reads the same cached answer. */
const CHANNELS_PAGE = { page: 1, limit: 10 };

type Props = ActionCardProps<"create_alert"> & { dependencies?: typeof DEPENDENCIES };

/** An API older than this card can still propose a balance alert or one without a dseq, which only gets the read-only summary. */
export const CreateAlertCard: FC<Props> = ({ action, decision, dependencies: d = DEPENDENCIES }) =>
  action.alert === "deployment_closed" && !!action.dseq ? (
    <DeploymentClosedAlertCard action={action} decision={decision} dependencies={d} />
  ) : (
    <d.GenericActionCard action={action} decision={decision} />
  );

const DeploymentClosedAlertCard: FC<Props & { dependencies: typeof DEPENDENCIES }> = ({ action, decision, dependencies: d }) => {
  const { api } = d.useServices();
  const queryClient = d.useQueryClient();
  const isAvailable = d.useFlag("ui_deployment_closed_alert");
  const { data: channels } = api.v1.listNotificationChannels.useQuery(CHANNELS_PAGE, { select: response => response.data });
  const { data: alerts, isFetched: hasReadAlerts } = api.v1.listDeploymentAlerts.useQuery({ dseq: action.dseq }, { select: response => response.data.alerts });
  const { mutateAsync: upsertDeploymentAlert } = api.v1.upsertDeploymentAlert.useMutation();

  const existing = alerts?.deploymentClosed;
  const channel = channels?.find(({ id }) => id === existing?.notificationChannelId) ?? channels?.[0];
  const hasNoChannel = channels !== undefined && !channel;

  const saveAlert = async () => {
    await upsertDeploymentAlert({ dseq: action.dseq, data: { alerts: { deploymentClosed: { notificationChannelId: channel!.id, enabled: true } } } });
    await queryClient.invalidateQueries({ queryKey: api.v1.listDeploymentAlerts.getKey({ dseq: action.dseq }) });
  };

  return (
    <d.ActionCardChrome
      title="Email me when this deployment closes"
      scope={`dseq ${action.dseq}`}
      tier={action.tier}
      decision={decision}
      rows={[
        { label: "Sends to", value: channel ? channel.config.addresses.join(", ") : hasNoChannel ? "No email set up" : "Loading…" },
        { label: "Alert", value: existing ? (existing.enabled ? "Already on, kept as is" : "Turns your existing alert back on") : "New" }
      ]}
      costNote="Email only, the same alert as in the deployment's settings."
      confirmLabel={existing ? "Update alert" : "Create alert"}
      successMessage="Alert saved."
      isConfirmDisabled={!isAvailable || !channel || !hasReadAlerts}
      onConfirm={saveAlert}
    >
      {!isAvailable && <p className="text-sm text-muted-foreground">Deployment closed alerts aren&apos;t available on your account yet.</p>}
      {isAvailable && hasNoChannel && (
        <p className="text-sm text-muted-foreground">
          Add an email address on the{" "}
          <Link href={UrlService.alerts()} className="font-medium text-foreground underline underline-offset-[3px]">
            Alerts page
          </Link>{" "}
          first, then ask again.
        </p>
      )}
    </d.ActionCardChrome>
  );
};
