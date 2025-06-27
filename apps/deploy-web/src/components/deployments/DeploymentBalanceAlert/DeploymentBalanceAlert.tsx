"use client";

import type { FC } from "react";
import React from "react";
import { useFormContext } from "react-hook-form";
import { CheckboxWithLabel, CustomTooltip, FormField, FormInput } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { NotificationChannelSelect } from "@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect";
import { Fieldset } from "@src/components/shared/Fieldset";

export type Props = {
  disabled?: boolean;
};

export const DeploymentBalanceAlert: FC<Props> = ({ disabled }) => {
  const { control } = useFormContext();

  return (
    <Fieldset
      label={
        <div className="flex items-center justify-between">
          <p className="mr-3 text-xl font-bold">Escrow Balance</p>
          <FormField
            control={control}
            name="deploymentBalance.enabled"
            render={({ field }) => (
              <CheckboxWithLabel
                label="Enabled"
                disabled={disabled}
                checked={field.value}
                onCheckedChange={value => field.onChange(value as boolean)}
                labelClassName="font-bold"
              />
            )}
          />
        </div>
      }
      subLabel="An additional alert will be sent when the account balance has been increased above threshold value."
      className="my-2"
    >
      <div className="space-y-4 py-4">
        <div className="space-y-3">
          <NotificationChannelSelect name="deploymentBalance.notificationChannelId" disabled={disabled} />
        </div>
        <div className="space-y-3">
          <FormField
            control={control}
            name="deploymentBalance.threshold"
            render={({ field }) => (
              <FormInput
                type="number"
                step={0.000001}
                label={
                  <div className="inline-flex items-center">
                    Threshold, USD
                    <CustomTooltip title="Alert if the deployment escrow balance is less than this amount.">
                      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                }
                className="mb-2 w-full"
                value={field.value}
                onChange={event => field.onChange(parseFloat(event.target.value))}
                disabled={disabled}
              />
            )}
          />
        </div>
      </div>
    </Fieldset>
  );
};
