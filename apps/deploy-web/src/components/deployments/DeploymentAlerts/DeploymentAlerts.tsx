"use client";

import { type FC, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, Card, LoadingButton, Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { merge } from "lodash";
import { CircleAlert, Mail } from "lucide-react";
import { z } from "zod";

import { AccountEmailChannelCreator } from "@src/components/alerts/AccountEmailChannelCreator/AccountEmailChannelCreator";
import type {
  ChildrenProps,
  ContainerInput,
  DeploymentAlertsOutput,
  FullAlertsInput
} from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { NotificationChannelDialog } from "@src/components/alerts/NotificationChannelDialog/NotificationChannelDialog";
import { NotificationChannelSelect } from "@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect";
import type {
  ChildrenProps as NotificationChannelsProps,
  NotificationChannelsOutput
} from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentCloseAlert/DeploymentCloseAlert";
import { useFlag } from "@src/hooks/useFlag";
import type { ChangeableComponentProps } from "@src/types/changeable-component-props.type";
import type { DeploymentDto } from "@src/types/deployment";

export const DEPENDENCIES = {
  DeploymentCloseAlert,
  NotificationChannelSelect,
  AccountEmailChannelCreator,
  NotificationChannelDialog,
  useFlag
};

export type Props = ChangeableComponentProps<{
  dependencies?: typeof DEPENDENCIES;
  notificationChannels: NotificationChannelsOutput;
  disabled?: boolean;
}>;

const schema = z.object({
  deploymentClosed: z.object({
    notificationChannelId: z.string().min(1, "Notification Channel is required"),
    enabled: z.boolean()
  })
});

const DEFAULT_VALUES = {
  deploymentClosed: {
    notificationChannelId: "",
    enabled: false
  }
};

const CARD_CLASSES = "overflow-hidden rounded-xl shadow-none";
const CARD_BLOCK_CLASSES = "space-y-3.5 px-5 py-5 sm:px-[22px]";
const CARD_FOOTER_CLASSES = "border-t px-5 py-3 sm:px-[22px]";

export const DeploymentAlertsView: FC<ChildrenProps & Props> = ({
  isLoading,
  isSaving,
  data,
  upsert,
  onStateChange,
  notificationChannels,
  disabled,
  dependencies: d = DEPENDENCIES
}) => {
  const isDeploymentClosedEnabled = d.useFlag("ui_deployment_closed_alert");

  const assignDefaults = useCallback(
    (alerts?: DeploymentAlertsOutput["alerts"]) => {
      return merge(
        {},
        DEFAULT_VALUES,
        {
          deploymentClosed: {
            notificationChannelId: notificationChannels[0]?.id || ""
          }
        },
        alerts?.deploymentClosed ? { deploymentClosed: alerts.deploymentClosed } : undefined
      );
    },
    [notificationChannels]
  );

  const providedValues = useMemo(() => {
    return assignDefaults(data?.alerts);
  }, [assignDefaults, data?.alerts]);

  const form = useForm({
    defaultValues: providedValues,
    reValidateMode: "onSubmit",
    resolver: zodResolver(schema)
  });

  const { isDirty, dirtyFields } = form.formState;
  const selectedChannelId = useWatch({ control: form.control, name: "deploymentClosed.notificationChannelId" });
  const selectedChannel = notificationChannels.find(channel => channel.id === selectedChannelId);
  const isLocked = isLoading || disabled;

  useEffect(() => {
    onStateChange?.({ hasChanges: !disabled && isDirty });
  }, [isDirty, disabled, onStateChange]);

  const submit = useCallback(async () => {
    const { deploymentClosed } = form.getValues();
    const payload: Partial<FullAlertsInput> = {};

    if (dirtyFields.deploymentClosed) {
      payload.deploymentClosed = deploymentClosed;
    }

    const nextValues = await upsert({ alerts: payload as ContainerInput["alerts"] });
    if (nextValues) {
      form.reset(assignDefaults(nextValues.alerts));
    }
  }, [dirtyFields.deploymentClosed, form, upsert, assignDefaults]);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <Card className={CARD_CLASSES}>
          <div className={CARD_BLOCK_CLASSES}>
            <CardOverline>Types</CardOverline>
            {isDeploymentClosedEnabled && <d.DeploymentCloseAlert disabled={isLocked} />}
          </div>

          <div className={cn(CARD_BLOCK_CLASSES, "border-t")}>
            <CardOverline>Recipients</CardOverline>
            <div className="space-y-2">
              <d.NotificationChannelSelect name="deploymentClosed.notificationChannelId" disabled={isLocked} isLabelHidden />
              {selectedChannel && (
                <p className="break-words text-xs text-muted-foreground">
                  Sends to <span className="text-foreground">{selectedChannel.config.addresses.join(", ")}</span>
                </p>
              )}
            </div>
          </div>

          {disabled ? (
            <p className={cn(CARD_FOOTER_CLASSES, "text-xs text-muted-foreground")}>Alerts can&apos;t be changed once a deployment is closed.</p>
          ) : (
            <div className={cn(CARD_FOOTER_CLASSES, "flex items-center justify-end gap-3")}>
              {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              <LoadingButton type="submit" size="sm" loading={isSaving} disabled={!isDirty || isSaving}>
                Save changes
              </LoadingButton>
            </div>
          )}
        </Card>
      </form>
    </FormProvider>
  );
};

export type PanelProps = {
  channels: Pick<NotificationChannelsProps, "data" | "isFetched" | "isError" | "refetch">;
  alerts: ChildrenProps;
  isDeploymentClosed: boolean;
  dependencies?: typeof DEPENDENCIES;
} & Pick<Props, "onStateChange">;

export const DeploymentAlertsPanel: FC<PanelProps> = ({ channels, alerts, isDeploymentClosed, onStateChange, dependencies: d = DEPENDENCIES }) => {
  const hasChannelsLoadFailed = channels.isError && !channels.data.length;
  const hasAlertsLoadFailed = alerts.isError && !alerts.data;

  const retryLoading = () => {
    channels.refetch();
    alerts.refetch();
  };

  if (hasChannelsLoadFailed || hasAlertsLoadFailed) {
    return <DeploymentAlertsLoadError onRetry={retryLoading} />;
  }

  if (!channels.isFetched || !alerts.isFetched) {
    return <DeploymentAlertsSkeleton />;
  }

  if (!channels.data.length && !isDeploymentClosed) {
    return <NotificationChannelRequired dependencies={d} />;
  }

  return <DeploymentAlertsView {...alerts} notificationChannels={channels.data} disabled={isDeploymentClosed} onStateChange={onStateChange} dependencies={d} />;
};

const CardOverline: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3">
    <h3 className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">{children}</h3>
    <span className="h-px flex-1 bg-border" aria-hidden />
  </div>
);

const DeploymentAlertsSkeleton: FC = () => (
  <Card className={CARD_CLASSES} role="status" aria-label="Loading alerts">
    <div className={CARD_BLOCK_CLASSES}>
      <CardOverline>Types</CardOverline>
      <div className="flex items-start gap-3">
        <Skeleton className="mt-px h-[18px] w-[18px] rounded" />
        <div className="w-full space-y-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
    </div>
    <div className={cn(CARD_BLOCK_CLASSES, "border-t")}>
      <CardOverline>Recipients</CardOverline>
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-9 w-11" />
        </div>
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
    </div>
    <div className={cn(CARD_FOOTER_CLASSES, "flex justify-end")}>
      <Skeleton className="h-8 w-28" />
    </div>
  </Card>
);

const DeploymentAlertsLoadError: FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <Card className={CARD_CLASSES}>
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <CircleAlert className="h-5 w-5 text-destructive" aria-hidden />
      <p className="text-sm font-semibold">Couldn&apos;t load this deployment&apos;s alerts</p>
      <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  </Card>
);

const NotificationChannelRequired: FC<{ dependencies: typeof DEPENDENCIES }> = ({ dependencies: d }) => {
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  return (
    <Card className={CARD_CLASSES}>
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold">No notification channel yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">Alerts are sent to a notification channel. Add one to choose who hears about this deployment.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <d.AccountEmailChannelCreator />
          <Button type="button" variant="outline" onClick={() => setIsAddingChannel(true)}>
            Add notification channel
          </Button>
        </div>
      </div>
      {isAddingChannel && <d.NotificationChannelDialog onClose={() => setIsAddingChannel(false)} />}
    </Card>
  );
};

export type ExternalProps = {
  deployment: Pick<DeploymentDto, "dseq" | "state">;
} & Pick<Props, "onStateChange">;

export const DeploymentAlerts: FC<ExternalProps> = ({ deployment, onStateChange }) => (
  <NotificationChannelsListContainer>
    {channels => (
      <DeploymentAlertsContainer deployment={deployment}>
        {alerts => (
          <DeploymentAlertsPanel channels={channels} alerts={alerts} isDeploymentClosed={deployment.state === "closed"} onStateChange={onStateChange} />
        )}
      </DeploymentAlertsContainer>
    )}
  </NotificationChannelsListContainer>
);
