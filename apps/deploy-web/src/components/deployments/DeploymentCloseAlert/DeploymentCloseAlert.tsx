"use client";

import type { FC } from "react";
import { useCallback } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { CheckboxWithLabel, Form, FormField, LoadingButton } from "@akashnetwork/ui/components";

import { AlertStatus } from "@src/components/alerts/AlertStatus/AlertStatus";
import { NotificationChannelSelect } from "@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect";
import { Fieldset } from "@src/components/shared/Fieldset";

type DeploymentClosedAlertInput = components["schemas"]["DeploymentAlertCreateInput"]["data"]["alerts"]["deploymentClosed"];
type DeploymentClosedAlertOutput = components["schemas"]["DeploymentAlertsResponse"]["data"]["alerts"]["deploymentClosed"];

export type Props = {
  isLoading: boolean;
  initialValues?: DeploymentClosedAlertOutput;
  onSubmit: (input: NonNullable<DeploymentClosedAlertInput>) => void;
};

export const DeploymentCloseAlert: FC<Props> = ({ onSubmit, initialValues, isLoading }) => {
  const form = useForm({
    defaultValues: initialValues || {
      enabled: true
    }
  });
  const { control } = form;

  const toggle = useCallback(() => {
    onSubmit(form.getValues());
  }, [onSubmit, form]);

  return (
    <Fieldset
      label={
        <div className="flex items-center">
          <p className="mr-3">Deployment Closed</p> {initialValues?.status && <AlertStatus status={initialValues.status} />}
        </div>
      }
      className="my-2"
    >
      <div className="space-y-4 p-4">
        <Form {...form}>
          <form className="space-y-4">
            <div className="space-y-3">
              <NotificationChannelSelect />
            </div>
            <div className="space-y-3">
              <FormField
                control={control}
                name="enabled"
                render={({ field }) => <CheckboxWithLabel label="Enabled" checked={field.value} onCheckedChange={value => field.onChange(value as boolean)} />}
              />
            </div>
            <div className="mt-2 space-y-3">
              <LoadingButton type="button" onClick={toggle} loading={isLoading}>
                {initialValues ? "Update" : "Create"}
              </LoadingButton>
            </div>
          </form>
        </Form>
      </div>
    </Fieldset>
  );
};
