import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { Button, Form, FormField, FormInput, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Undo2 } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { useBackNav } from "@src/hooks/useBackNav";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: "Required" })
});

export type SignInFormValues = z.infer<typeof formSchema>;

interface Props {
  isLoading?: boolean;
  onSubmit: (values: SignInFormValues) => void;
  onForgotPasswordClick?: () => void;
  defaultEmail?: string;
  onEmailChange?: (email: string) => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DEPENDENCIES = {
  Button,
  Form,
  FormField,
  FormInput,
  Spinner,
  Link,
  useBackNav,
  useForm
};

export function SignInForm({ dependencies: d = DEPENDENCIES, ...props }: Props) {
  const form = d.useForm<SignInFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: props.defaultEmail || "",
      password: ""
    }
  });
  const goBack = d.useBackNav("/");
  const emitSubmit = form.handleSubmit(values => props.onSubmit(values));

  const onForgotPasswordClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      props.onForgotPasswordClick?.();
    },
    [props.onForgotPasswordClick]
  );

  return (
    <d.Form {...form}>
      <form noValidate={true} autoComplete="on" onSubmit={emitSubmit} className="flex flex-col items-center justify-start gap-5 self-stretch">
        <div className="flex flex-col items-start justify-start gap-4 self-stretch">
          <d.FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <d.FormInput
                className="w-full"
                type="email"
                label="Email"
                placeholder="m@example.com"
                value={field.value}
                onChange={event => {
                  field.onChange(event.target.value);
                  props.onEmailChange?.(event.target.value);
                }}
              />
            )}
          />
          <d.FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <d.FormInput
                className="w-full"
                type="password"
                labelClassName="flex items-center justify-between"
                label={
                  <>
                    <div>Password</div>
                    <div>
                      <d.Link
                        className="text-xs text-current underline hover:no-underline"
                        prefetch={false}
                        href="#"
                        onClick={onForgotPasswordClick}
                        tabIndex={-1}
                      >
                        Forgot password?
                      </d.Link>
                    </div>
                  </>
                }
                placeholder="••••••••"
                value={field.value}
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />
        </div>
        <div className="flex flex-col-reverse gap-5 self-stretch sm:flex-row">
          <d.Button type="button" onClick={goBack} variant="outline" className="h-9 flex-1 border-neutral-200 dark:border-neutral-800">
            <Undo2 className="mr-2 h-4 w-4" />
            Go Back
          </d.Button>

          <d.Button disabled={!!props.isLoading} type="submit" className="h-9 flex-1">
            <LogIn className="mr-2 h-4 w-4" />
            {props.isLoading ? <Spinner size="small" /> : "Log in"}
          </d.Button>
        </div>
      </form>
    </d.Form>
  );
}
