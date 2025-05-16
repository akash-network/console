"use client";

import type { FC } from "react";
import { useMemo } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Form, FormField, FormInput, FormMessage, Textarea } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1).max(100),
  emails: z.preprocess(
    value => {
      if (typeof value !== "string") return [];
      return value
        .split(",")
        .map(email => email.trim())
        .filter(Boolean);
    },
    z
      .array(z.string())
      .min(1, "At least one email is required")
      .superRefine((emails, ctx) => {
        const invalids = emails.filter(email => !z.string().email().safeParse(email).success);
        if (invalids.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "One or more email addresses are invalid."
          });
        }
      })
  )
});
type FormValues = z.infer<typeof formSchema>;

export interface ContactPointFormProps {
  onSubmit: (data: FormValues) => void;
  onCancel: (state: { hasChanges: boolean }) => void | Promise<void>;
}

export const ContactPointForm: FC<ContactPointFormProps> = ({ onCancel, ...props }) => {
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      emails: []
    },
    resolver: zodResolver(formSchema)
  });

  const { control, handleSubmit } = form;

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        props.onSubmit(values);
        form.reset();
      } catch (err) {
        setError("Failed to create contact point. Please try again.");
      }
    },
    [props, form]
  );
  const hasChanges = useMemo(() => !!Object.keys(form.formState.dirtyFields).length, [form.formState.dirtyFields]);
  console.log("DEBUG hasChanges", hasChanges);
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
                <FormInput label="Name" value={field.value} placeholder="Contact point name..." onChange={event => field.onChange(event.target.value)} />
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
                    rows={4}
                    label="Emails"
                    value={field.value}
                    placeholder="Comma separated email address..."
                    onChange={event => field.onChange(event.target.value)}
                  />
                  <FormMessage className={cn({ "pt-2": !!fieldState.error })} />
                </>
              )}
            />
          </div>

          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="submit">Save</Button>
            {onCancel && (
              <Button type="button" variant="secondary" onClick={() => onCancel({ hasChanges })}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};
