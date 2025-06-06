"use client";

import type { FC } from "react";
import { useCallback } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { CheckboxWithLabel, Form, FormField, LoadingButton } from "@akashnetwork/ui/components";

import { ContactPointSelect } from "@src/components/alerts/ContactPointSelectForm/ContactPointSelect";
import { Fieldset } from "@src/components/shared/Fieldset";

type DeploymentClosedAlertInput = components["schemas"]["DeploymentAlertCreateInput"]["data"]["alerts"]["deploymentClosed"];

export type Props = {
  isLoading: boolean;
  initialValues?: DeploymentClosedAlertInput;
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
    <Fieldset label={`Deployment Close${!initialValues ? " (not configured)" : ""}`} className="my-2">
      <div className="space-y-4 p-4">
        <Form {...form}>
          <form className="space-y-4">
            <div className="space-y-3">
              <ContactPointSelect />
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
                Save
              </LoadingButton>
            </div>
          </form>
        </Form>
      </div>
    </Fieldset>
  );
};
