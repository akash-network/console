"use client";

import { useForm } from "react-hook-form";
import { Button, Form, FormField, FormInput, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { RemoteApiError } from "@src/components/shared/RemoteApiError/RemoteApiError";
import { useServices } from "@src/context/ServicesProvider";

/** Single-field passwordless entry form: blocks submission unless the input is a syntactically valid email. */
const formSchema = z.object({
  email: z.string().email()
});

export type EmailCodeStartValues = z.infer<typeof formSchema>;

export const DEPENDENCIES = {
  Button,
  Form,
  FormField,
  FormInput,
  RemoteApiError,
  Spinner,
  useForm,
  useMutation
};

interface Props {
  defaultEmail?: string;
  getCaptchaToken: () => Promise<string>;
  onStarted: (email: string) => void;
  dependencies?: typeof DEPENDENCIES;
}

export function EmailCodeStart({ dependencies: d = DEPENDENCIES, ...props }: Props) {
  const { authService } = useServices();

  const startMutation = d.useMutation({
    async mutationFn(input: { email: string }) {
      const captchaToken = await props.getCaptchaToken();
      await authService.startEmailCode({ email: input.email, captchaToken });
    },
    onSuccess(_data, variables) {
      props.onStarted(variables.email);
    }
  });

  const form = d.useForm<EmailCodeStartValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: props.defaultEmail || "" }
  });
  const emitSubmit = form.handleSubmit(values => startMutation.mutate(values));

  return (
    <>
      <d.RemoteApiError className="w-full" error={startMutation.error} />
      <d.Form {...form}>
        <form noValidate autoComplete="on" onSubmit={emitSubmit} className="flex w-full flex-col gap-5 self-stretch">
          <d.FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <d.FormInput
                className="w-full"
                type="email"
                label="Email"
                placeholder="you@company.com"
                value={field.value}
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />
          <d.Button type="submit" aria-label="Continue with email" disabled={startMutation.isPending} className="h-10 w-full">
            {startMutation.isPending ? <d.Spinner size="small" /> : "Continue with email"}
          </d.Button>
        </form>
      </d.Form>
      <p className="text-center text-xs leading-4 text-neutral-500 dark:text-neutral-400">We&apos;ll email you a 6 digit code. No password to remember.</p>
    </>
  );
}
