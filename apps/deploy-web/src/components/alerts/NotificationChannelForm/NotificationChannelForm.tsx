import type { FC } from "react";
import React, { useCallback, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, DialogV2Body, DialogV2Footer, Form, FormField, FormInput, FormMessage, LoadingButton, Textarea } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { isEqual } from "lodash";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  emails: z.string().min(1, "At least one email is required")
});
type FormValues = z.infer<typeof formSchema>;
type DataValues = Pick<FormValues, "name"> & { emails: string[] };

export type NotificationChannelFormProps = {
  initialValues?: DataValues;
  submitLabel: string;
  onSubmit: (data: DataValues) => void;
  onCancel: () => void;
  isLoading?: boolean;
};

function splitEmails(value: string) {
  return value
    .split(",")
    .map(email => email.trim())
    .filter(Boolean);
}

export const NotificationChannelForm: FC<NotificationChannelFormProps> = ({ initialValues, submitLabel, onSubmit, onCancel, isLoading }) => {
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
    (values: FormValues) => {
      const emails = splitEmails(values.emails);
      const invalids = emails.filter(email => !z.string().email().safeParse(email).success);

      if (invalids.length > 0) {
        form.setError("emails", { message: `Invalid email addresses: ${invalids.join(", ")}` });
        return;
      }

      onSubmit({ name: values.name, emails: Array.from(new Set(emails)) });
    },
    [form, onSubmit]
  );

  /** The dialog can open from inside another form, and React bubbles submit events through portals. */
  const submitWithoutOuterForm = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.stopPropagation();
      return handleSubmit(submit)(event);
    },
    [handleSubmit, submit]
  );

  const currentValues = useWatch({ control });

  const hasChanges = useMemo(() => {
    const fields = Object.keys(initialFormValues) as (keyof FormValues)[];
    return fields.some(key => !isEqual(initialFormValues[key], currentValues[key]));
  }, [currentValues, initialFormValues]);

  return (
    <Form {...form}>
      <form onSubmit={submitWithoutOuterForm} className="flex min-h-0 flex-1 flex-col">
        <DialogV2Body className="space-y-4">
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormInput
                data-testid="notification-channel-form-name"
                label="Name"
                value={field.value}
                placeholder="Ops team"
                onChange={event => field.onChange(event.target.value)}
                disabled={isLoading}
              />
            )}
          />
          <FormField
            control={control}
            name="emails"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Textarea
                  data-testid="notification-channel-form-emails"
                  rows={3}
                  label="Emails"
                  value={field.value}
                  placeholder="ops@company.com"
                  onChange={event => field.onChange(event.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Separate several addresses with commas.</p>
                <FormMessage data-testid="notification-channel-form-emails-error" />
              </div>
            )}
          />
        </DialogV2Body>

        <DialogV2Footer>
          <Button data-testid="notification-channel-form-cancel" disabled={isLoading} type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <LoadingButton data-testid="notification-channel-form-submit" disabled={!hasChanges} loading={isLoading} type="submit">
            {submitLabel}
          </LoadingButton>
        </DialogV2Footer>
      </form>
    </Form>
  );
};
