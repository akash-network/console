import type { FC } from "react";
import { useEffect } from "react";
import React from "react";
import { useMemo } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert, Button, Form, FormField, FormInput, FormMessage, LoadingButton, Textarea } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { isEqual } from "lodash";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1).max(100),
  emails: z.string().min(1, "At least one email is required")
});
type FormValues = z.infer<typeof formSchema>;
type DataValues = Pick<FormValues, "name"> & { emails: string[] };

export interface ContactPointFormProps {
  values?: DataValues;
  onSubmit: (data: DataValues) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const ContactPointForm: FC<ContactPointFormProps> = ({ onCancel, isLoading, ...props }) => {
  const [error, setError] = useState<string | null>(null);
  const { confirm } = usePopup();

  const initialValues: FormValues = useMemo(
    () => ({
      name: props.values?.name || "",
      emails: props.values?.emails?.length ? props.values.emails.join(", ") : ""
    }),
    [props.values]
  );

  const form = useForm<FormValues>({
    defaultValues: initialValues,
    reValidateMode: "onSubmit",
    resolver: zodResolver(formSchema)
  });

  useEffect(() => {
    if (props.values) {
      form.setValue("name", props.values.name || "");
      form.setValue("emails", props.values.emails?.length ? props.values.emails.join(", ") : "");
    }
  }, [form, props.values]);

  const { control, handleSubmit } = form;

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        const invalids = values.emails.split(",").filter(email => !z.string().email().safeParse(email).success);

        if (invalids.length > 0) {
          form.setError("emails", {
            message: `Invalid email addresses: ${invalids.join(", ")}`
          });

          return;
        }

        props.onSubmit({
          ...values,
          emails: values.emails
            .split(",")
            .map(email => email.trim())
            .filter(Boolean)
        });
      } catch (err) {
        setError("Failed to create contact point. Please try again.");
      }
    },
    [props]
  );

  const currentValues = useWatch({ control });

  const hasChanges = useMemo(() => {
    const fields = Object.keys(initialValues) as (keyof FormValues)[];
    return fields.some(key => !isEqual(initialValues[key], currentValues[key]));
  }, [currentValues, initialValues]);

  const cancel = useCallback(async () => {
    const canCancel = !hasChanges || (await confirm("Unsaved changes would be lost. Are you sure you want to cancel?"));

    if (canCancel && onCancel) {
      onCancel();
    }
  }, [confirm, hasChanges, onCancel]);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">New Email Contact Point</h2>

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormInput
                  data-testid="contact-point-form-name"
                  label="Name"
                  value={field.value}
                  placeholder="Contact point name..."
                  onChange={event => field.onChange(event.target.value)}
                  disabled={isLoading}
                />
              )}
            />
          </div>
          <div className="space-y-3">
            <FormField
              control={control}
              name="emails"
              render={({ field, fieldState }) => (
                <>
                  <Textarea
                    data-testid="contact-point-form-emails"
                    rows={4}
                    label="Emails"
                    value={field.value}
                    placeholder="Comma separated email address..."
                    onChange={event => field.onChange(event.target.value)}
                    disabled={isLoading}
                  />
                  <FormMessage data-testid="contact-point-form-emails-error" className={cn({ "pt-2": !!fieldState.error })} />
                </>
              )}
            />
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="flex justify-end gap-2 pt-4">
            <LoadingButton data-testid="contact-point-form-submit" disabled={isLoading} loading={isLoading} type="submit">
              Save
            </LoadingButton>

            {onCancel && (
              <Button data-testid="contact-point-form-cancel" disabled={isLoading} type="button" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};
