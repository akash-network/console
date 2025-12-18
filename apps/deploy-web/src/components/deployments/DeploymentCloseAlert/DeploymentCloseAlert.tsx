"use client";

import type { FC } from "react";
import React from "react";
import { useFormContext } from "react-hook-form";
import { CheckboxWithLabel, FormField } from "@akashnetwork/ui/components";

import { NotificationChannelSelect } from "@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect";
import { Fieldset } from "@src/components/shared/Fieldset";

export const DeploymentCloseAlert: FC<{ disabled?: boolean }> = ({ disabled }) => {
  const { control } = useFormContext();

  return (
    <Fieldset
      label={
        <div className="flex items-center justify-between">
          <p className="mr-3 text-xl font-bold">Deployment Close</p>
          <FormField
            control={control}
            name="deploymentClosed.enabled"
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
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <NotificationChannelSelect name="deploymentClosed.notificationChannelId" disabled={disabled} />
        </div>
      </div>
    </Fieldset>
  );
};
