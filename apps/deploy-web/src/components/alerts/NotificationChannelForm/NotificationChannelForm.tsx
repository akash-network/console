import type { FC } from "react";
import { useEffect } from "react";
import React from "react";
import { useMemo } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert, Button, Form, FormField, FormInput, FormMessage, LoadingButton, Textarea } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { isEqual } from "lodash";
import { z } from "zod";

import type { ChangeableComponentProps } from "@src/types/changeable-component-props.type";

const formSchema = z.object({
  name: z.string().min(1).max(100),
  emails: z.string().min(1, "At least one email is required")
});
type FormValues = z.infer<typeof formSchema>;
type DataValues = Pick<FormValues, "name"> & { emails: string[] };

export type NotificationChannelFormProps = ChangeableComponentProps<{
  initialValues?: DataValues;
  onSubmit: (data: DataValues) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}>;

export const NotificationChannelForm: FC<NotificationChannelFormProps> = ({ onCancel, isLoading, onSubmit, onStateChange, initialValues }) => {
  const [error, setError] = useState<string | null>(null);

  const initialFormValues: FormValues = useMemo(() => {
    return {
      name: initialValues?.name || "",
      emails: initialValues?.emails?.join(", ") || ""
    };
  }, [initialValues]);

  const form = useForm<FormValues>({
    defaultValues: initialFormValues,
    reValidateMode: "onSubmit",
    resolver: zodResolver(formSchema)
  });

  const { control, handleSubmit } = form;

  const submit = useCallback(
    async (values: FormValues) => {
      try {
        const emails = values.emails
          .split(",")
          .map(email => email.trim())
          .filter(Boolean);

        const invalids = emails.filter(email => !z.string().email().safeParse(email).success);

        if (invalids.length > 0) {
          form.setError("emails", {
            message: `Invalid email addresses: ${invalids.join(", ")}`
          });

          return;
        }

        onSubmit({
          ...values,
          emails: Array.from(new Set(emails))
        });
      } catch (err) {
        setError("Failed to save notification channel. Please try again.");
      }
    },
    [form, onSubmit]
  );

  const currentValues = useWatch({ control });

  const hasChanges = useMemo(() => {
    const fields = Object.keys(initialFormValues) as (keyof FormValues)[];
    return fields.some(key => !isEqual(initialFormValues[key], currentValues[key]));
  }, [currentValues, initialFormValues]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        hasChanges
      });
    }
  }, [hasChanges, onStateChange]);

  const cancel = useCallback(() => onCancel?.(), [onCancel]);

  return (
    <div className="space-y-4 p-4">
      <Form {...form}>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="space-y-3">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormInput
                  data-testid="notification-channel-form-name"
                  label="Name"
                  value={field.value}
                  placeholder="Notification channel name..."
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
                    data-testid="notification-channel-form-emails"
                    rows={4}
                    label="Emails"
                    value={field.value}
                    placeholder="Comma separated email address..."
                    onChange={event => field.onChange(event.target.value)}
                    disabled={isLoading}
                  />
                  <FormMessage data-testid="notification-channel-form-emails-error" className={cn({ "pt-2": !!fieldState.error })} />
                </>
              )}
            />
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="flex justify-end gap-2 pt-4">
            <LoadingButton data-testid="notification-channel-form-submit" disabled={isLoading || !hasChanges} loading={isLoading} type="submit">
              Save
            </LoadingButton>

            {onCancel && (
              <Button data-testid="notification-channel-form-cancel" disabled={isLoading} type="button" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};
