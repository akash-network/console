"use client";

import { type FC, useCallback, useEffect, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LoadingButton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { merge } from "lodash";
import { z } from "zod";

import type {
  ChildrenProps,
  ContainerInput,
  DeploymentAlertsOutput,
  FullAlertsInput
} from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { NotificationChannelsGuard } from "@src/components/alerts/NotificationChannelsGuard/NotificationChannelsGuard";
import type { NotificationChannelsOutput } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentCloseAlert/DeploymentCloseAlert";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useFlag } from "@src/hooks/useFlag";
import type { ChangeableComponentProps } from "@src/types/changeable-component-props.type";
import type { DeploymentDto } from "@src/types/deployment";

const DEPENDENCIES = {
  DeploymentCloseAlert,
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
        <div className="mb-6 flex items-center text-xl font-semibold">
          <h3 className="mr-6">Configure Alerts</h3>
          {!disabled && (
            <LoadingButton type="submit" loading={isSaving} disabled={!isDirty || isSaving} size="md">
              Save Changes
            </LoadingButton>
          )}
        </div>
        {isDeploymentClosedEnabled && (
          <div className="mb-6">
            <d.DeploymentCloseAlert disabled={isLoading || disabled} />
          </div>
        )}
      </form>
    </FormProvider>
  );
};

export type ExternalProps = {
  deployment: Pick<DeploymentDto, "dseq" | "state">;
} & Pick<Props, "onStateChange">;

export const DeploymentAlerts: FC<ExternalProps> = ({ deployment, onStateChange }) => {
  return (
    <NotificationChannelsGuard>
      {({ data: notificationChannels }) => (
        <DeploymentAlertsContainer deployment={deployment}>
          {props => (
            <LoadingBlocker isLoading={!props.isFetched}>
              <DeploymentAlertsView
                {...props}
                onStateChange={onStateChange}
                notificationChannels={notificationChannels}
                disabled={deployment.state === "closed"}
              />
            </LoadingBlocker>
          )}
        </DeploymentAlertsContainer>
      )}
    </NotificationChannelsGuard>
  );
};
