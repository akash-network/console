"use client";

import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LoadingButton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { merge } from "lodash";
import isEqual from "lodash/isEqual";
import pick from "lodash/pick";
import { z } from "zod";

import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { DeploymentAlertsContainer } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import { NotificationChannelsGuard } from "@src/components/alerts/NotificationChannelsGuard/NotificationChannelsGuard";
import type { NotificationChannelsOutput } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { DeploymentBalanceAlert } from "@src/components/deployments/DeploymentBalanceAlert/DeploymentBalanceAlert";
import { DeploymentCloseAlert } from "@src/components/deployments/DeploymentCloseAlert/DeploymentCloseAlert";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import type { DeploymentDto } from "@src/types/deployment";
import { ceilDecimal } from "@src/utils/mathHelpers";

const COMPONENTS = {
  DeploymentCloseAlert,
  DeploymentBalanceAlert
};

export type Props = {
  components?: typeof COMPONENTS;
  maxBalanceThreshold: number;
  onStateChange: (params: { hasChanges: boolean }) => void;
  notificationChannels: NotificationChannelsOutput;
  disabled?: boolean;
};

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

const pickFormValues = (providedValues: NonNullable<ChildrenProps["data"]>["alerts"]) => {
  return pick(providedValues, [
    "deploymentBalance.enabled",
    "deploymentBalance.notificationChannelId",
    "deploymentBalance.threshold",
    "deploymentClosed.enabled",
    "deploymentClosed.notificationChannelId"
  ]) as z.infer<typeof schema>;
};

export const DeploymentAlertsView: FC<ChildrenProps & Props> = ({
  isLoading,
  data,
  upsert,
  maxBalanceThreshold,
  onStateChange,
  notificationChannels,
  disabled,
  components: c = COMPONENTS
}) => {
  const strictSchema = useMemo(() => {
    return schema.extend({
      deploymentBalance: z.object({
        threshold: z.number().max(maxBalanceThreshold, "Threshold must be less than or equal to the current balance").min(0, "Threshold must be greater than 0")
      })
    });
  }, [maxBalanceThreshold]);

  const providedValues = useMemo(() => {
    return data?.alerts && Object.keys(data?.alerts).length
      ? pickFormValues(data.alerts)
      : merge({}, DEFAULT_VALUES, {
          deploymentBalance: {
            notificationChannelId: notificationChannels[0]?.id || "",
            threshold: ceilDecimal(0.3 * maxBalanceThreshold)
          },
          deploymentClosed: {
            notificationChannelId: notificationChannels[0]?.id || ""
          }
        });
  }, [data?.alerts, maxBalanceThreshold, notificationChannels]);

  const form = useForm({
    defaultValues: providedValues,
    reValidateMode: "onSubmit",
    resolver: zodResolver(strictSchema)
  });

  const [hasChanges, setHasChanges] = useState(false);
  const values = form.watch();

  useEffect(() => {
    const hasChangesNext = !isEqual(providedValues, values);
    if (hasChanges !== hasChangesNext) {
      setHasChanges(hasChangesNext);
      onStateChange({ hasChanges: hasChangesNext });
    }
  }, [providedValues, onStateChange, values, hasChanges]);

  const submit = useCallback(async () => {
    const nextValues = await upsert({ alerts: values });
    if (nextValues) {
      form.reset(pickFormValues(nextValues.alerts));
    }
  }, [upsert, values, form]);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="my-4 flex items-center text-xl font-bold">
          <h3 className="mr-4">Configure Alerts</h3>
          {!disabled && (
            <LoadingButton type="submit" loading={isLoading} disabled={!hasChanges}>
              Save Changes
            </LoadingButton>
          )}
        </div>
        <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
          <c.DeploymentBalanceAlert disabled={isLoading || disabled} />
          <c.DeploymentCloseAlert disabled={isLoading || disabled} />
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
