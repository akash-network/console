"use client";

import type { FC } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { CheckboxWithLabel, CustomTooltip, Form, FormField, FormInput, LoadingButton } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { ContactPointSelect } from "@src/components/alerts/ContactPointSelectForm/ContactPointSelect";
import { Fieldset } from "@src/components/shared/Fieldset";

type DeploymentBalanceAlertInput = components["schemas"]["DeploymentAlertCreateInput"]["data"]["alerts"]["deploymentBalance"];

type Props = {
  initialValues?: DeploymentBalanceAlertInput;
  onSubmit: (input: NonNullable<DeploymentBalanceAlertInput>) => void;
};

export const DeploymentBalanceAlert: FC<Props> = ({ initialValues, onSubmit }) => {
  const form = useForm({
    defaultValues: initialValues || {
      threshold: 0,
      enabled: true
    }
  });
  const { handleSubmit, control, getValues } = form;

  const save = () => {
    onSubmit(getValues());
  };

  return (
    <Fieldset label={`Deployment Deposit${!initialValues ? " (not configured)" : ""}`} className="my-2">
      <div className="space-y-4 p-4">
        <Form {...form}>
          <form onSubmit={handleSubmit(save)} className="space-y-4">
            <div className="space-y-3">
              <ContactPointSelect />
            </div>
            <div className="space-y-3">
              <FormField
                control={control}
                name="threshold"
                render={({ field }) => (
                  <FormInput
                    type="number"
                    label={
                      <div className="inline-flex items-center">
                        Threshold
                        <CustomTooltip title="Alert if the deployment deposit is less than this amount.">
                          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                        </CustomTooltip>
                      </div>
                    }
                    className="mb-2 w-full"
                    value={field.value}
                    onChange={event => field.onChange(parseInt(event.target.value))}
                    min={0}
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
              <LoadingButton type="submit">Save</LoadingButton>
            </div>
          </form>
        </Form>
      </div>
    </Fieldset>
  );
};
