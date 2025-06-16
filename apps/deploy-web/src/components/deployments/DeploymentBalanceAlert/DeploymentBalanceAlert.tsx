"use client";

import type { FC } from "react";
import { useMemo } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { CheckboxWithLabel, CustomTooltip, Form, FormField, FormInput, LoadingButton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoCircle } from "iconoir-react";
import { z } from "zod";

import { AlertStatus } from "@src/components/alerts/AlertStatus/AlertStatus";
import { NotificationChannelSelect } from "@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect";
import { DeploymentBalanceContainer } from "@src/components/deployments/DeploymentBalanceContainer/DeploymentBalanceContainer";
import { Fieldset } from "@src/components/shared/Fieldset";
import type { DeploymentDto } from "@src/types/deployment";
import { ceilDecimal, denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";

type DeploymentBalanceAlertInput = components["schemas"]["DeploymentAlertCreateInput"]["data"]["alerts"]["deploymentBalance"];
type DeploymentBalanceAlertOutput = components["schemas"]["DeploymentAlertsResponse"]["data"]["alerts"]["deploymentBalance"];

export type Props = {
  isLoading: boolean;
  initialValues?: DeploymentBalanceAlertOutput;
  onSubmit: (input: NonNullable<DeploymentBalanceAlertInput>) => void;
};

export const DeploymentBalanceAlertView: FC<Props & { balance: number; toDenom: (value: number) => number }> = ({
  initialValues,
  onSubmit,
  balance,
  isLoading,
  toDenom
}) => {
  const schema = useMemo(() => {
    return z.object({
      threshold: z.number().max(balance, {
        message: `Threshold must be less than the current deployment balance of ${balance}.`
      }),
      enabled: z.boolean(),
      notificationChannelId: z.string()
    });
  }, [balance]);

  const defaultValues = useMemo(() => {
    if (!initialValues) {
      return {
        threshold: balance,
        enabled: true
      };
    }

    if (initialValues.threshold) {
      return {
        ...initialValues,
        threshold: ceilDecimal(udenomToDenom(initialValues.threshold))
      };
    }

    return initialValues;
  }, [balance, initialValues]);

  const form = useForm<z.infer<typeof schema>>({
    defaultValues,
    resolver: zodResolver(schema),
    reValidateMode: "onSubmit"
  });
  const { handleSubmit, control, getValues } = form;

  const submit = () => {
    const values = getValues();

    onSubmit(
      values.threshold
        ? {
            ...values,
            threshold: denomToUdenom(toDenom(values.threshold))
          }
        : values
    );
  };

  return (
    <Fieldset
      label={
        <div className="flex items-center">
          <p className="mr-3">Deployment Deposit</p> {initialValues?.status && <AlertStatus status={initialValues.status} />}
        </div>
      }
      subLabel="An additional alert will be sent when the account balance has been increased above threshold value."
      className="my-2"
    >
      <div className="space-y-4 p-4">
        <Form {...form}>
          <form onSubmit={handleSubmit(submit)} className="space-y-4">
            <div className="space-y-3">
              <NotificationChannelSelect />
            </div>
            <div className="space-y-3">
              <FormField
                control={control}
                name="threshold"
                render={({ field }) => (
                  <FormInput
                    type="number"
                    step={0.000001}
                    label={
                      <div className="inline-flex items-center">
                        Threshold, USD
                        <CustomTooltip title="Alert if the deployment deposit is less than this amount.">
                          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                        </CustomTooltip>
                      </div>
                    }
                    className="mb-2 w-full"
                    value={field.value}
                    onChange={event => field.onChange(parseFloat(event.target.value))}
                    max={balance}
                  />
                )}
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-3">
                <FormField
                  control={control}
                  name="enabled"
                  render={({ field }) => (
                    <CheckboxWithLabel label="Enabled" checked={field.value} onCheckedChange={value => field.onChange(value as boolean)} />
                  )}
                />
              </div>
            </div>
            <div className="space-y-3">
              <LoadingButton type="submit" loading={isLoading}>
                {initialValues ? "Update" : "Create"}
              </LoadingButton>
            </div>
          </form>
        </Form>
      </div>
    </Fieldset>
  );
};

export const DeploymentBalanceAlert: FC<Props & { deployment: DeploymentDto }> = ({ deployment, ...props }) => {
  return (
    <DeploymentBalanceContainer deployment={deployment}>
      {({ balance, toDenom }) => <DeploymentBalanceAlertView {...props} balance={balance} toDenom={toDenom} />}
    </DeploymentBalanceContainer>
  );
};
