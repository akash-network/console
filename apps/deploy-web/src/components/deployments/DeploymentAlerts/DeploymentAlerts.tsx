"use client";

import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LoadingButton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { merge } from "lodash";
import isEqual from "lodash/isEqual";
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
import { DeploymentBalanceAlert } from "@src/components/deployments/DeploymentBalanceAlert/DeploymentBalanceAlert";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentCloseAlert/DeploymentCloseAlert";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useFlag } from "@src/hooks/useFlag";
import type { ChangeableComponentProps } from "@src/types/changeable-component-props.type";
import type { DeploymentDto } from "@src/types/deployment";
import { ceilDecimal } from "@src/utils/mathHelpers";

const DEPENDENCIES = {
  DeploymentCloseAlert,
  DeploymentBalanceAlert,
  useFlag
};

export type Props = ChangeableComponentProps<{
  dependencies?: typeof DEPENDENCIES;
  maxBalanceThreshold: number;
  notificationChannels: NotificationChannelsOutput;
  disabled?: boolean;
}>;

const schema = z.object({
  deploymentBalance: z.object({
    notificationChannelId: z.string().min(1, "Notification Channel is required"),
    threshold: z.number().min(0, "Threshold must be greater than 0"),
    enabled: z.boolean()
  }),
  deploymentClosed: z.object({
    notificationChannelId: z.string().min(1, "Notification Channel is required"),
    enabled: z.boolean()
  })
});

const DEFAULT_VALUES = {
  deploymentBalance: {
    notificationChannelId: "",
    threshold: 0,
    enabled: false
  },
  deploymentClosed: {
    notificationChannelId: "",
    enabled: false
  }
};

export const DeploymentAlertsView: FC<ChildrenProps & Props> = ({
  isLoading,
  data,
  upsert,
  maxBalanceThreshold,
  onStateChange,
  notificationChannels,
  disabled,
  dependencies: d = DEPENDENCIES
}) => {
  const isDeploymentClosedEnabled = d.useFlag("ui_deployment_closed_alert");
  const strictSchema = useMemo(() => {
    return schema.extend({
      deploymentBalance: z.object({
        threshold: z.number().max(maxBalanceThreshold, "Threshold must be less than or equal to the current balance").min(0, "Threshold must be greater than 0")
      })
    });
  }, [maxBalanceThreshold]);

  const assignDefaults = useCallback(
    (alerts?: DeploymentAlertsOutput["alerts"]) => {
      return merge(
        {},
        DEFAULT_VALUES,
        {
          deploymentBalance: {
            notificationChannelId: notificationChannels[0]?.id || "",
            threshold: ceilDecimal(0.3 * maxBalanceThreshold)
          },
          deploymentClosed: {
            notificationChannelId: notificationChannels[0]?.id || ""
          }
        },
        alerts
      );
    },
    [maxBalanceThreshold, notificationChannels]
  );

  const providedValues = useMemo(() => {
    return assignDefaults(data?.alerts);
  }, [assignDefaults, data?.alerts]);

  const form = useForm({
    defaultValues: providedValues,
    reValidateMode: "onSubmit",
    resolver: zodResolver(strictSchema)
  });

  const [hasChanges, setHasChanges] = useState(false);
  const values = form.watch();

  useEffect(() => {
    if (!onStateChange) {
      return;
    }
    const hasChangesNext = !isEqual(providedValues, values);
    if (hasChanges !== hasChangesNext) {
      setHasChanges(hasChangesNext);
      onStateChange({ hasChanges: hasChangesNext });
    }
  }, [providedValues, onStateChange, values, hasChanges]);

  const submit = useCallback(async () => {
    const { deploymentBalance, deploymentClosed } = values;
    const payload: Partial<FullAlertsInput> = {};

    if (!isEqual(providedValues.deploymentBalance, deploymentBalance)) {
      payload.deploymentBalance = deploymentBalance;
    }

    if (!isEqual(providedValues.deploymentClosed, deploymentClosed)) {
      payload.deploymentClosed = deploymentClosed;
    }

    const nextValues = await upsert({ alerts: payload as ContainerInput["alerts"] });
    if (nextValues) {
      form.reset(assignDefaults(nextValues.alerts));
    }
  }, [values, providedValues.deploymentBalance, providedValues.deploymentClosed, upsert, form, assignDefaults]);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="my-6 flex items-center text-xl font-semibold">
          <h3 className="mr-6">Configure Alerts</h3>
          {!disabled && (
            <LoadingButton type="submit" loading={isLoading} disabled={!hasChanges} size="sm">
              Save Changes
            </LoadingButton>
          )}
        </div>
        <div className="grid-col-1 mb-6 grid gap-6 md:grid-cols-2">
          <d.DeploymentBalanceAlert disabled={isLoading || disabled} />
          {isDeploymentClosedEnabled && <d.DeploymentCloseAlert disabled={isLoading || disabled} />}
        </div>
      </form>
    </FormProvider>
  );
};

export type ExternalProps = {
  deployment: Pick<DeploymentDto, "escrowBalance" | "dseq" | "denom" | "state">;
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
