"use client";

import { useForm } from "react-hook-form";
import { Form, FormField, FormInput, LoadingButton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { RemoteApiError } from "@src/components/shared/RemoteApiError/RemoteApiError";
import { useServices } from "@src/context/ServicesProvider";
import { markCodeSent } from "../PasswordlessAuth/withPersistedPasswordlessFlow";

/** Single-field passwordless entry form: blocks submission unless the input is a syntactically valid email. */
const formSchema = z.object({
  email: z.string().email()
});

export type EmailCodeStartValues = z.infer<typeof formSchema>;

export const DEPENDENCIES = {
  Form,
  FormField,
  FormInput,
  LoadingButton,
  RemoteApiError,
  markCodeSent,
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
  const { authService, analyticsService } = useServices();

  const startMutation = d.useMutation({
    async mutationFn(input: { email: string }) {
      analyticsService.track("email_login_init");
      const captchaToken = await props.getCaptchaToken();
      await authService.startEmailCode({ email: input.email, captchaToken });
    },
    onSuccess(_data, variables) {
      d.markCodeSent();
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
          <d.LoadingButton type="submit" loading={startMutation.isPending} loadingIndicator={<ButtonSpinner />} className="h-10 w-full">
            Continue with email
          </d.LoadingButton>
        </form>
      </d.Form>
      <p className="text-center text-xs leading-4 text-neutral-500 dark:text-neutral-400">We&apos;ll email you a 6 digit code. No password to remember.</p>
    </>
  );
}

/**
 * Ring spinner tinted with the button's foreground color via `border-current`, so it stays visible on
 * solid buttons. The shared `Spinner`'s arc is `fill-primary`, which equals `bg-primary` and vanishes there.
 */
function ButtonSpinner() {
  return (
    <span role="status" className="mr-2 flex items-center justify-center">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      <span className="sr-only">Loading...</span>
    </span>
  );
}
